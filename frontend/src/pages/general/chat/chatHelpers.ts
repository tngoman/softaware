import DOMPurify from 'dompurify';
import { API_BASE_URL } from '../../../services/api';

/**
 * Shared types and helpers for the staff chat UI.
 */

// ── Constants ───────────────────────────────────────────────

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_FILE_SIZE_LABEL = '10 MB';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// ── Helpers ─────────────────────────────────────────────────

/** Get full URL for a relative file path */
export function getFileUrl(relativePath?: string | null): string {
  if (!relativePath) return '';
  if (relativePath.startsWith('http')) return relativePath;
  // Build from API base URL origin
  try {
    const url = new URL(API_BASE_URL);
    return `${url.origin}${relativePath}`;
  } catch {
    return relativePath;
  }
}

export function isImageType(type?: string | null): boolean {
  return type === 'image' || false;
}
export function isVideoType(type?: string | null): boolean {
  return type === 'video' || false;
}
export function isAudioType(type?: string | null): boolean {
  return type === 'audio' || false;
}
export function isFileType(type?: string | null): boolean {
  return type === 'file' || false;
}

export function sanitize(text?: string | null): string {
  if (!text) return '';
  return DOMPurify.sanitize(text);
}

/**
 * Convert simple markdown-like syntax to HTML:
 *   *bold*  →  <strong>
 *   _italic_  →  <em>
 *   ~strikethrough~  →  <del>
 *   `inline code`  →  <code>
 *   ```codeblock```  →  <pre><code>
 *   @mentions are highlighted
 */
export function renderMarkdown(text?: string | null): string {
  if (!text) return '';

  let html = text;

  // Escape HTML entities first (we build our own tags)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks: ```...``` (multiline)
  html = html.replace(/```([\s\S]*?)```/g, (_m, code) => {
    return `<pre class="bg-black/10 rounded px-2 py-1 my-1 text-xs font-mono overflow-x-auto whitespace-pre"><code>${code.trim()}</code></pre>`;
  });

  // Inline code: `...`
  html = html.replace(/`([^`\n]+)`/g, (_m, code) => {
    return `<code class="bg-black/10 rounded px-1 py-0.5 text-xs font-mono">${code}</code>`;
  });

  // Bold: *text*
  html = html.replace(/\*([^\s*][^*]*[^\s*])\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^\s*])\*/g, '<strong>$1</strong>'); // single char

  // Italic: _text_
  html = html.replace(/(?<![a-zA-Z0-9])_([^\s_][^_]*[^\s_])_(?![a-zA-Z0-9])/g, '<em>$1</em>');
  html = html.replace(/(?<![a-zA-Z0-9])_([^\s_])_(?![a-zA-Z0-9])/g, '<em>$1</em>'); // single char

  // Strikethrough: ~text~
  html = html.replace(/~([^\s~][^~]*[^\s~])~/g, '<del>$1</del>');
  html = html.replace(/~([^\s~])~/g, '<del>$1</del>'); // single char

  // @mention highlights (pattern: @<userId> or @Name)
  html = html.replace(/@([a-zA-Z0-9_-]+(?:\s[a-zA-Z0-9_-]+)?)/g,
    '<span class="bg-blue-100 text-blue-700 rounded px-0.5 font-medium">@$1</span>'
  );

  // Auto-link URLs
  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline break-all">$1</a>'
  );

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'em', 'del', 'code', 'pre', 'span', 'a', 'br'],
    ALLOWED_ATTR: ['class', 'href', 'target', 'rel'],
  });
}

export function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function formatTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatMessageTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function getMessagePreview(content?: string | null, messageType?: string | null): string {
  if (messageType === 'image') return '📷 Photo';
  if (messageType === 'video') return '🎥 Video';
  if (messageType === 'audio') return '🎤 Voice message';
  if (messageType === 'file') return '📎 File';
  if (messageType === 'gif') return 'GIF';
  if (messageType === 'location') return '📍 Location';
  if (messageType === 'contact') return '👤 Contact';
  if (messageType === 'system') return content || 'System message';
  if (!content) return '';
  return content.length > 60 ? content.substring(0, 57) + '...' : content;
}

/**
 * Download a file using fetch with ReadableStream for progress tracking.
 * Returns true if download completed.
 */
export async function downloadWithProgress(
  url: string,
  fileName: string,
  onProgress: (pct: number) => void,
): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download failed');

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    if (!response.body) {
      // Fallback: no ReadableStream, direct download
      const blob = await response.blob();
      triggerDownload(blob, fileName);
      onProgress(100);
      return true;
    }

    const reader = response.body.getReader();
    const chunks: BlobPart[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total > 0) {
        onProgress(Math.min(99, Math.round((received / total) * 100)));
      } else {
        // Unknown total — show indeterminate progress
        onProgress(Math.min(99, Math.round(received / 1024))); // Rough KB marker
      }
    }

    const blob = new Blob(chunks);
    triggerDownload(blob, fileName);
    onProgress(100);
    return true;
  } catch (err) {
    console.error('Download error:', err);
    return false;
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
  }, 100);
}

/**
 * Client-side image compression using Canvas API.
 * Resizes images to max 1920px width/height and compresses to ~80% JPEG quality.
 * Target: under 1MB for chat images.
 * Returns a new File object with the compressed data.
 */
export const MAX_IMAGE_DIMENSION = 1920;
export const IMAGE_QUALITY = 0.8;
export const COMPRESS_THRESHOLD = 500 * 1024; // Only compress if > 500KB

export async function compressImage(file: File): Promise<File> {
  // Skip if not an image or already small
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= COMPRESS_THRESHOLD) return file;
  // Skip GIFs (compression would lose animation)
  if (file.type === 'image/gif') return file;

  return new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if needed
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
          width = MAX_IMAGE_DIMENSION;
        } else {
          width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
          height = MAX_IMAGE_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file); // Fallback — return original
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // If compressed is bigger, return original
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressed);
        },
        'image/jpeg',
        IMAGE_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // Fallback — return original
    };

    img.src = url;
  });
}
