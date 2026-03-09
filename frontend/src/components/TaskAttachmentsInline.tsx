import React, { useState, useEffect } from 'react';
import { PaperClipIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import { softwareAuthHeaders } from '../utils/softwareAuth';

interface Attachment {
  attachment_id: number;
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  comment_id?: number | null;
  is_from_ticket?: number;
}

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i;

function buildFileUrl(apiUrl: string, att: Attachment): string {
  if (att.file_path?.startsWith('http')) return att.file_path;
  try {
    const baseUrl = new URL(apiUrl).origin;
    const folder = att.is_from_ticket ? 'tickets' : 'development';
    return `${baseUrl}/uploads/${folder}/${att.file_path}`;
  } catch {
    return '';
  }
}

// Simple in-memory cache to avoid re-fetching on every render
const attachmentCache = new Map<string, Attachment[]>();

/** Clear the attachment cache (call after uploading new files) */
export function clearAttachmentCache(taskId?: string | number) {
  if (taskId) {
    const keysToDelete: string[] = [];
    attachmentCache.forEach((_, key) => {
      if (key.endsWith(`:${taskId}`)) keysToDelete.push(key);
    });
    keysToDelete.forEach(k => attachmentCache.delete(k));
  } else {
    attachmentCache.clear();
  }
}

const TaskAttachmentsInline: React.FC<{
  taskId: string | number;
  apiUrl: string;
  softwareId?: number;
  onImageClick?: (url: string) => void;
}> = ({ taskId, apiUrl, softwareId, onImageClick }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    if (!taskId || !apiUrl) return;
    const cacheKey = `${apiUrl}:${taskId}`;
    if (attachmentCache.has(cacheKey)) {
      setAttachments(attachmentCache.get(cacheKey)!);
      return;
    }
    let cancelled = false;
    api.get(`/softaware/tasks/${taskId}/attachments`, {
      params: { apiUrl },
      headers: softwareAuthHeaders(softwareId),
    }).then(res => {
      if (cancelled) return;
      const raw = res.data?.data || res.data?.attachments || res.data || [];
      const list: Attachment[] = Array.isArray(raw) ? raw : [];
      // Only show task-level attachments (no comment attachments)
      const taskLevel = list.filter(a => !a.comment_id);
      attachmentCache.set(cacheKey, taskLevel);
      setAttachments(taskLevel);
    }).catch(() => { /* silently fail */ });
    return () => { cancelled = true; };
  }, [taskId, apiUrl, softwareId]);

  if (attachments.length === 0) return null;

  const shown = attachments.slice(0, 4);
  const extra = attachments.length - 4;

  return (
    <div className="flex items-center gap-1.5 mt-2">
      {shown.map(att => {
        const url = buildFileUrl(apiUrl, att);
        const isImage = IMAGE_EXT.test(att.file_name || '') || att.mime_type?.startsWith('image/');
        return isImage ? (
          <img key={att.attachment_id} src={url} alt={att.file_name}
            onClick={(e) => { e.stopPropagation(); onImageClick?.(url); }}
            className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity bg-gray-100"
            loading="lazy" />
        ) : (
          <span key={att.attachment_id}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-gray-100 border rounded text-gray-500 max-w-[100px] truncate">
            <PaperClipIcon className="h-3 w-3 shrink-0" /> {att.file_name}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="text-[10px] text-gray-400 font-medium">+{extra}</span>
      )}
    </div>
  );
};

export default TaskAttachmentsInline;
