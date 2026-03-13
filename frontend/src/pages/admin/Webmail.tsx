import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  InboxIcon,
  PaperAirplaneIcon,
  TrashIcon,
  FolderIcon,
  StarIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PaperClipIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ArrowsRightLeftIcon,
  EnvelopeIcon,
  EnvelopeOpenIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
  FlagIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import {
  WebmailModel,
  WebmailAccountModel,
} from '../../models';
import type {
  MailboxAccount,
  MailFolder,
  MailMessageHeader,
  MailMessage,
  MessageListResponse,
} from '../../models';
import { getApiBaseUrl } from '../../config/app';

// ─── Folder icon helper ──────────────────────────────────────────────────

const getFolderIcon = (specialUse: string, path: string) => {
  const lower = path.toLowerCase();
  if (specialUse === '\\Inbox' || lower === 'inbox') return InboxIcon;
  if (specialUse === '\\Sent' || lower.includes('sent')) return PaperAirplaneIcon;
  if (specialUse === '\\Trash' || lower.includes('trash')) return TrashIcon;
  if (specialUse === '\\Drafts' || lower.includes('draft')) return PencilSquareIcon;
  if (specialUse === '\\Junk' || lower.includes('junk') || lower.includes('spam')) return ExclamationTriangleIcon;
  if (specialUse === '\\Flagged' || lower.includes('star')) return StarIcon;
  if (specialUse === '\\Archive' || lower.includes('archive')) return ArchiveBoxIcon;
  return FolderIcon;
};

// ─── Date formatter ──────────────────────────────────────────────────────

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatFullDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString([], {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSE MODAL
// ═══════════════════════════════════════════════════════════════════════════

interface ComposeProps {
  accounts: MailboxAccount[];
  defaultAccountId: number;
  activeFolder?: string;
  replyTo?: MailMessage | null;
  replyAll?: boolean;
  forward?: MailMessage | null;
  onClose: () => void;
  onSent: () => void;
}

const ComposeModal: React.FC<ComposeProps> = ({
  accounts, defaultAccountId, activeFolder: propFolder, replyTo, replyAll, forward, onClose, onSent,
}) => {
  const [sending, setSending] = useState(false);
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const bodyInitialized = useRef(false);

  // Build the signature HTML for the current account
  const getSignatureHtml = useCallback((acctId: number) => {
    const acct = accounts.find(a => a.id === acctId);
    if (!acct?.signature) return '';
    return `<br/><div class="email-signature" style="margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 12px;">${acct.signature}</div>`;
  }, [accounts]);

  // Populate fields for reply / forward
  useEffect(() => {
    let html = '';
    const sig = getSignatureHtml(accountId);

    if (replyTo) {
      setTo(replyTo.from.address);
      setSubject(replyTo.subject.startsWith('Re:') ? replyTo.subject : `Re: ${replyTo.subject}`);
      if (replyAll) {
        const ccAddrs = [...replyTo.to, ...replyTo.cc]
          .map(a => a.address)
          .filter(a => a !== replyTo.from.address)
          .join(', ');
        setCc(ccAddrs);
        setShowCcBcc(!!ccAddrs);
      }
      html = `<br/>${sig}<br/><div style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 4px; color: #666;">
        <p>On ${formatFullDate(replyTo.date)}, ${replyTo.from.name || replyTo.from.address} wrote:</p>
        ${replyTo.html || `<pre>${replyTo.text}</pre>`}
      </div>`;
    } else if (forward) {
      setSubject(forward.subject.startsWith('Fwd:') ? forward.subject : `Fwd: ${forward.subject}`);
      html = `<br/>${sig}<br/><div style="border-top: 1px solid #ccc; padding-top: 12px; margin-top: 12px;">
        <p><strong>---------- Forwarded message ----------</strong></p>
        <p>From: ${forward.from.name} &lt;${forward.from.address}&gt;</p>
        <p>Date: ${formatFullDate(forward.date)}</p>
        <p>Subject: ${forward.subject}</p>
        <p>To: ${forward.to.map(a => a.address).join(', ')}</p>
        <br/>
        ${forward.html || `<pre>${forward.text}</pre>`}
      </div>`;

      // Download original attachments for forwarding
      if (forward.attachments?.length > 0) {
        (async () => {
          const downloadedFiles: File[] = [];
          for (const att of forward.attachments) {
            try {
              const url = `${getApiBaseUrl()}/api${WebmailModel.getAttachmentUrl(
                defaultAccountId, propFolder || 'INBOX', forward.uid, att.partId
              )}`;
              const resp = await fetch(url, {
                credentials: 'include',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
              });
              if (resp.ok) {
                const blob = await resp.blob();
                const file = new File([blob], att.filename || `attachment-${att.partId}`, {
                  type: att.contentType || 'application/octet-stream',
                });
                downloadedFiles.push(file);
              }
            } catch (e) {
              console.warn('Failed to download forward attachment:', att.filename, e);
            }
          }
          if (downloadedFiles.length > 0) {
            setAttachments(prev => [...prev, ...downloadedFiles]);
          }
        })();
      }
    } else {
      // New compose — just the signature
      if (sig) {
        html = `<br/>${sig}`;
      }
    }

    if (html) {
      setBody(html);
      // Set editor content directly in this effect to avoid timing issues
      if (editorRef.current) {
        editorRef.current.innerHTML = html;
        bodyInitialized.current = true;
      }
    }
  }, [replyTo, replyAll, forward]);

  // Fallback: set editor HTML when body state updates (for cases where ref wasn't ready)
  useEffect(() => {
    if (editorRef.current && body && !bodyInitialized.current) {
      editorRef.current.innerHTML = body;
      bodyInitialized.current = true;
    }
  }, [body]);

  // ─── File handling ───────────────────────────────────────────────────
  const addFiles = (files: FileList | File[]) => {
    const newFiles = Array.from(files);
    setAttachments(prev => {
      const existing = new Set(prev.map(f => `${f.name}-${f.size}`));
      const unique = newFiles.filter(f => !existing.has(`${f.name}-${f.size}`));
      return [...prev, ...unique];
    });
  };

  const removeFile = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const totalSize = attachments.reduce((sum, f) => sum + f.size, 0);

  const handleSend = async () => {
    if (!to.trim()) {
      Swal.fire({ icon: 'warning', title: 'Missing recipient', text: 'Please enter a To address' });
      return;
    }
    if (!subject.trim()) {
      const confirm = await Swal.fire({
        icon: 'question', title: 'No subject',
        text: 'Send without a subject?', showCancelButton: true,
      });
      if (!confirm.isConfirmed) return;
    }
    if (totalSize > 25 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'Attachments too large', text: 'Total attachment size must be under 25 MB.' });
      return;
    }

    setSending(true);
    try {
      const htmlContent = editorRef.current?.innerHTML || body;
      await WebmailModel.send({
        account_id: accountId,
        to, cc, bcc, subject,
        html: htmlContent,
        text: editorRef.current?.innerText || '',
        inReplyTo: replyTo?.messageId,
        references: replyTo?.messageId,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      Swal.fire({ icon: 'success', title: 'Sent!', timer: 1200, showConfirmButton: false });
      onSent();
      onClose();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Send failed', text: err.response?.data?.error || err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className={`bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col relative ${dragging ? 'ring-2 ring-picton-blue ring-offset-2' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragging && (
          <div className="absolute inset-0 z-10 bg-picton-blue/10 border-2 border-dashed border-picton-blue rounded-xl flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <PaperClipIcon className="w-12 h-12 text-picton-blue mx-auto mb-2" />
              <p className="text-lg font-semibold text-picton-blue">Drop files to attach</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-xl">
          <h3 className="text-lg font-semibold text-gray-900">
            {replyTo ? 'Reply' : forward ? 'Forward' : 'New Message'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-200">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* From account selector */}
          {accounts.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500 w-12">From:</span>
              <select
                value={accountId}
                onChange={e => {
                  const newId = Number(e.target.value);
                  // Swap signature in editor when switching accounts
                  if (editorRef.current) {
                    const editor = editorRef.current;
                    const oldSig = editor.querySelector('.email-signature');
                    if (oldSig) oldSig.remove();
                    const newSigHtml = getSignatureHtml(newId);
                    if (newSigHtml) {
                      editor.insertAdjacentHTML('beforeend', newSigHtml);
                    }
                  }
                  setAccountId(newId);
                }}
                className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-picton-blue"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.display_name} &lt;{a.email_address}&gt;</option>
                ))}
              </select>
            </div>
          )}

          {/* To */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500 w-12">To:</span>
            <input
              type="text" value={to} onChange={e => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-picton-blue"
            />
            {!showCcBcc && (
              <button onClick={() => setShowCcBcc(true)} className="text-xs text-picton-blue hover:underline">
                Cc/Bcc
              </button>
            )}
          </div>

          {/* CC / BCC */}
          {showCcBcc && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500 w-12">Cc:</span>
                <input
                  type="text" value={cc} onChange={e => setCc(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-picton-blue"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500 w-12">Bcc:</span>
                <input
                  type="text" value={bcc} onChange={e => setBcc(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-picton-blue"
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-500 w-12">Subj:</span>
            <input
              type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-picton-blue"
            />
          </div>

          {/* Rich text editor (contentEditable) */}
          <div className="border rounded-lg">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-gray-50 text-gray-600">
              <button onClick={() => document.execCommand('bold')} className="p-1 rounded hover:bg-gray-200 font-bold text-sm">B</button>
              <button onClick={() => document.execCommand('italic')} className="p-1 rounded hover:bg-gray-200 italic text-sm">I</button>
              <button onClick={() => document.execCommand('underline')} className="p-1 rounded hover:bg-gray-200 underline text-sm">U</button>
              <div className="w-px h-5 bg-gray-300 mx-1" />
              <button onClick={() => document.execCommand('insertUnorderedList')} className="p-1 rounded hover:bg-gray-200 text-sm">• List</button>
              <button onClick={() => document.execCommand('insertOrderedList')} className="p-1 rounded hover:bg-gray-200 text-sm">1. List</button>
              <div className="w-px h-5 bg-gray-300 mx-1" />
              <button onClick={() => {
                const url = prompt('Enter link URL:');
                if (url) document.execCommand('createLink', false, url);
              }} className="p-1 rounded hover:bg-gray-200 text-sm">🔗</button>
              <div className="w-px h-5 bg-gray-300 mx-1" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded hover:bg-gray-200 text-sm flex items-center gap-1"
                title="Attach files"
              >
                <PaperClipIcon className="w-4 h-4" /> Attach
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = ''; } }}
              />
            </div>
            {/* Editor area */}
            <div
              ref={editorRef}
              contentEditable
              className="min-h-[200px] max-h-[400px] overflow-y-auto p-3 text-sm focus:outline-none"
              suppressContentEditableWarning
            />
          </div>

          {/* Attachments list */}
          {attachments.length > 0 && (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Attachments ({attachments.length})
                </span>
                <span className="text-xs text-gray-400">
                  {totalSize < 1024 ? `${totalSize} B`
                    : totalSize < 1024 * 1024 ? `${(totalSize / 1024).toFixed(1)} KB`
                    : `${(totalSize / (1024 * 1024)).toFixed(1)} MB`}
                  {' / 25 MB'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center gap-1.5 bg-white border rounded-lg px-2.5 py-1.5 text-sm">
                    <PaperClipIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="max-w-[160px] truncate text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {file.size < 1024 ? `${file.size} B`
                        : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB`
                        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                    <button
                      onClick={() => removeFile(idx)}
                      className="p-0.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              {totalSize > 25 * 1024 * 1024 && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Total size exceeds 25 MB limit
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 rounded-b-xl">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Discard
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              title="Attach files"
            >
              <PaperClipIcon className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-picton-blue rounded-lg hover:bg-picton-blue/90 disabled:opacity-50"
          >
            {sending ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <PaperAirplaneIcon className="w-4 h-4" />
            )}
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN WEBMAIL PAGE
// ═══════════════════════════════════════════════════════════════════════════

const Webmail: React.FC = () => {
  // ─── State ─────────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<MailboxAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<MailboxAccount | null>(null);
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>('INBOX');
  const [messages, setMessages] = useState<MailMessageHeader[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MailMessage | null>(null);
  const [totalMessages, setTotalMessages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);

  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<MailMessage | null>(null);
  const [replyAll, setReplyAll] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<MailMessage | null>(null);

  // ─── Load accounts ─────────────────────────────────────────────────────
  const loadAccounts = useCallback(async () => {
    try {
      const accts = await WebmailAccountModel.list();
      setAccounts(accts);
      if (accts.length > 0 && !activeAccount) {
        const defaultAcct = accts.find(a => a.is_default) || accts[0];
        setActiveAccount(defaultAcct);
      }
    } catch (err) {
      console.error('Failed to load mailboxes:', err);
    }
  }, [activeAccount]);

  // ─── Load folders ──────────────────────────────────────────────────────
  const loadFolders = useCallback(async () => {
    if (!activeAccount) return;
    setLoadingFolders(true);
    try {
      const f = await WebmailModel.getFolders(activeAccount.id);
      setFolders(f);
    } catch (err: any) {
      console.error('Failed to load folders:', err);
      const status = err.response?.status;
      if (status === 400 || status === 401 || status === 404) {
        Swal.fire({
          icon: 'error', title: status === 401 ? 'Authentication Failed' : 'Connection Error',
          text: err.response?.data?.message || `Could not connect to ${activeAccount.email_address}. Check settings in Profile → Mailboxes.`,
        });
      }
    } finally {
      setLoadingFolders(false);
    }
  }, [activeAccount]);

  // ─── Load messages ─────────────────────────────────────────────────────
  const loadMessages = useCallback(async (page?: number) => {
    if (!activeAccount) return;
    setLoading(true);
    setSelectedMessage(null);
    try {
      const p = page || currentPage;
      const result = await WebmailModel.getMessages(activeAccount.id, activeFolder, p, 50, search || undefined);
      setMessages(result.messages);
      setTotalMessages(result.total);
      setTotalPages(result.pages);
      setCurrentPage(result.page);
    } catch (err: any) {
      console.error('Failed to load messages:', err);
      if (err.response?.status === 401) {
        Swal.fire({
          icon: 'error', title: 'Authentication Failed',
          text: err.response?.data?.message || `Could not connect to ${activeAccount.email_address}. Please update your password in Profile → Mailboxes.`,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [activeAccount, activeFolder, currentPage, search]);

  // ─── Effects ───────────────────────────────────────────────────────────
  useEffect(() => { loadAccounts(); }, []);

  useEffect(() => {
    if (activeAccount) {
      loadFolders();
      setActiveFolder('INBOX');
      setCurrentPage(1);
      setSelectedMessage(null);
    }
  }, [activeAccount?.id]);

  useEffect(() => {
    if (activeAccount) {
      loadMessages(1);
    }
  }, [activeAccount?.id, activeFolder]);

  // ─── Open message ──────────────────────────────────────────────────────
  const openMessage = async (msg: MailMessageHeader) => {
    if (!activeAccount) return;
    setLoadingMessage(true);
    try {
      const full = await WebmailModel.getMessage(activeAccount.id, activeFolder, msg.uid);
      setSelectedMessage(full);

      // Mark as seen in local list
      setMessages(prev => prev.map(m =>
        m.uid === msg.uid ? { ...m, flags: Array.from(new Set([...m.flags, '\\Seen'])) } : m
      ));
    } catch (err) {
      console.error('Failed to load message:', err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load message' });
    } finally {
      setLoadingMessage(false);
    }
  };

  // ─── Actions ───────────────────────────────────────────────────────────
  const handleDelete = async (uid: number) => {
    if (!activeAccount) return;
    try {
      await WebmailModel.deleteMessage(activeAccount.id, activeFolder, uid);
      setMessages(prev => prev.filter(m => m.uid !== uid));
      if (selectedMessage?.uid === uid) setSelectedMessage(null);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete message' });
    }
  };

  const handleToggleFlag = async (uid: number, flag: 'seen' | 'flagged') => {
    if (!activeAccount) return;
    const msg = messages.find(m => m.uid === uid);
    if (!msg) return;

    const isFlagged = flag === 'seen' ? msg.flags.includes('\\Seen') : msg.flags.includes('\\Flagged');

    try {
      await WebmailModel.flagMessage(activeAccount.id, activeFolder, uid, { [flag]: !isFlagged });
      const flagStr = flag === 'seen' ? '\\Seen' : '\\Flagged';
      setMessages(prev => prev.map(m => {
        if (m.uid !== uid) return m;
        return {
          ...m,
          flags: isFlagged
            ? m.flags.filter(f => f !== flagStr)
            : [...m.flags, flagStr],
        };
      }));
    } catch (err) {
      console.error('Failed to update flag:', err);
    }
  };

  const handleReply = (all: boolean = false) => {
    if (!selectedMessage) return;
    setReplyTo(selectedMessage);
    setReplyAll(all);
    setForwardMsg(null);
    setShowCompose(true);
  };

  const handleForward = () => {
    if (!selectedMessage) return;
    setForwardMsg(selectedMessage);
    setReplyTo(null);
    setReplyAll(false);
    setShowCompose(true);
  };

  const handleCompose = () => {
    setReplyTo(null);
    setReplyAll(false);
    setForwardMsg(null);
    setShowCompose(true);
  };

  const defaultAccountId = activeAccount?.id || accounts.find(a => a.is_default)?.id || accounts[0]?.id || 0;

  // ─── No accounts state ────────────────────────────────────────────────
  if (accounts.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <EnvelopeIcon className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No Email Accounts Connected</h2>
        <p className="text-gray-500 mb-6 max-w-md">
          Connect your email accounts from your <strong>Profile → Mailboxes</strong> tab to start using webmail.
        </p>
        <a href="/profile" className="px-5 py-2.5 bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 font-medium">
          Go to Profile
        </a>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Activity indicator bar */}
      {(loading || loadingMessage || loadingFolders) && (
        <div className="h-1 w-full bg-gray-200 overflow-hidden rounded-full mb-1 flex-shrink-0">
          <div className="h-full bg-picton-blue rounded-full animate-pulse" style={{ width: '100%', animation: 'indeterminate 1.5s ease-in-out infinite' }} />
          <style>{`@keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
        </div>
      )}
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-4">
        {/* Account switcher */}
        {accounts.length > 1 && (
          <select
            value={activeAccount?.id || ''}
            onChange={e => {
              const acct = accounts.find(a => a.id === Number(e.target.value));
              if (acct) setActiveAccount(acct);
            }}
            className="px-3 py-2 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-picton-blue"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.display_name} ({a.email_address})
              </option>
            ))}
          </select>
        )}
        {accounts.length === 1 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <EnvelopeIcon className="w-4 h-4" />
            <span className="font-medium">{activeAccount?.display_name}</span>
            <span className="text-gray-400">&lt;{activeAccount?.email_address}&gt;</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadMessages(1)}
            placeholder="Search messages..."
            className="pl-9 pr-4 py-2 text-sm border rounded-lg w-64 focus:ring-2 focus:ring-picton-blue"
          />
        </div>

        <button
          onClick={() => { loadFolders(); loadMessages(1); }}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          title="Refresh"
        >
          <ArrowPathIcon className="w-5 h-5" />
        </button>

        <button
          onClick={handleCompose}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-picton-blue rounded-lg hover:bg-picton-blue/90"
        >
          <PencilSquareIcon className="w-4 h-4" />
          Compose
        </button>
      </div>

      {/* Main area — 3-column layout */}
      <div className="flex flex-1 border rounded-xl bg-white shadow-sm overflow-hidden min-h-0">
        {/* Column 1: Folder tree */}
        <div className="w-56 flex-shrink-0 border-r bg-gray-50 overflow-y-auto">
          <div className="p-3 space-y-0.5">
            {loadingFolders ? (
              <div className="flex items-center justify-center py-8">
                <ArrowPathIcon className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : folders.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No folders</p>
            ) : (
              folders.map(folder => {
                const FolderIconComp = getFolderIcon(folder.specialUse, folder.path);
                const isActive = activeFolder === folder.path;
                return (
                  <button
                    key={folder.path}
                    onClick={() => { setActiveFolder(folder.path); setCurrentPage(1); setSelectedMessage(null); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                      isActive
                        ? 'bg-picton-blue text-white shadow-sm'
                        : 'text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <FolderIconComp className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    <span className="flex-1 text-left truncate">{folder.name}</span>
                    {folder.unseenMessages > 0 && (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-picton-blue text-white'
                      }`}>
                        {folder.unseenMessages}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Message list */}
        <div className={`${selectedMessage ? 'w-80' : 'flex-1'} flex-shrink-0 border-r flex flex-col min-h-0`}>
          {/* Message list header */}
          <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">
              {activeFolder} ({totalMessages})
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { if (currentPage > 1) loadMessages(currentPage - 1); }}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500">{currentPage}/{totalPages}</span>
                <button
                  onClick={() => { if (currentPage < totalPages) loadMessages(currentPage + 1); }}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Message list body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <ArrowPathIcon className="w-6 h-6 text-gray-300 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <InboxIcon className="w-10 h-10 mb-2" />
                <p className="text-sm">No messages</p>
              </div>
            ) : (
              messages.map(msg => {
                const isSeen = msg.flags.includes('\\Seen');
                const isFlagged = msg.flags.includes('\\Flagged');
                const isSelected = selectedMessage?.uid === msg.uid;
                return (
                  <button
                    key={msg.uid}
                    onClick={() => openMessage(msg)}
                    className={`w-full text-left px-3 py-2.5 border-b transition-colors ${
                      isSelected
                        ? 'bg-picton-blue/10 border-l-2 border-l-picton-blue'
                        : 'hover:bg-gray-50'
                    } ${!isSeen ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleFlag(msg.uid, 'flagged'); }}
                        className="flex-shrink-0"
                      >
                        {isFlagged ? (
                          <StarIconSolid className="w-4 h-4 text-yellow-400" />
                        ) : (
                          <StarIcon className="w-4 h-4 text-gray-300 hover:text-yellow-400" />
                        )}
                      </button>
                      <span className={`flex-1 text-sm truncate ${!isSeen ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {msg.from.name || msg.from.address}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(msg.date)}</span>
                    </div>
                    <div className={`text-sm truncate mt-0.5 ${!isSeen ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                      {msg.subject}
                    </div>
                    {msg.preview && (
                      <div className="text-xs text-gray-400 truncate mt-0.5">{msg.preview}</div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 3: Reading pane */}
        {selectedMessage ? (
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {loadingMessage ? (
              <div className="flex-1 flex items-center justify-center">
                <ArrowPathIcon className="w-6 h-6 text-gray-300 animate-spin" />
              </div>
            ) : (
              <>
                {/* Message header */}
                <div className="px-5 py-4 border-b bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{selectedMessage.subject}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-8 h-8 rounded-full bg-picton-blue/20 flex items-center justify-center text-picton-blue text-sm font-bold flex-shrink-0">
                          {(selectedMessage.from.name || selectedMessage.from.address)[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {selectedMessage.from.name || selectedMessage.from.address}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            &lt;{selectedMessage.from.address}&gt; · {formatFullDate(selectedMessage.date)}
                          </p>
                        </div>
                      </div>
                      {selectedMessage.to.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          To: {selectedMessage.to.map(a => a.name || a.address).join(', ')}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleReply(false)} title="Reply"
                        className="p-2 rounded-lg hover:bg-gray-200 text-gray-500">
                        <ArrowUturnLeftIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleReply(true)} title="Reply All"
                        className="p-2 rounded-lg hover:bg-gray-200 text-gray-500">
                        <ArrowsRightLeftIcon className="w-4 h-4" />
                      </button>
                      <button onClick={handleForward} title="Forward"
                        className="p-2 rounded-lg hover:bg-gray-200 text-gray-500">
                        <ArrowUturnRightIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(selectedMessage.uid)} title="Delete"
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Attachments */}
                {selectedMessage.attachments.length > 0 && (
                  <div className="px-5 py-2 border-b bg-yellow-50/50">
                    <div className="flex items-center gap-2 flex-wrap">
                      <PaperClipIcon className="w-4 h-4 text-gray-400" />
                      {selectedMessage.attachments.map(att => (
                        <a
                          key={att.partId}
                          href={`${getApiBaseUrl()}/api${WebmailModel.getAttachmentUrl(
                            activeAccount!.id, activeFolder, selectedMessage.uid, att.partId
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded-md hover:bg-gray-50"
                        >
                          <span className="truncate max-w-[150px]">{att.filename}</span>
                          <span className="text-gray-400">({formatSize(att.size)})</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message body (sandboxed) */}
                <div className="flex-1 overflow-y-auto">
                  {selectedMessage.html ? (
                    <iframe
                      srcDoc={`
                        <!DOCTYPE html>
                        <html><head>
                          <meta charset="utf-8">
                          <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #333; margin: 16px; line-height: 1.5; }
                            img { max-width: 100%; height: auto; }
                            a { color: #3b82f6; }
                            table { max-width: 100%; }
                            blockquote { border-left: 3px solid #ddd; padding-left: 12px; margin-left: 0; color: #666; }
                          </style>
                        </head><body>${selectedMessage.html}</body></html>
                      `}
                      sandbox="allow-same-origin"
                      className="w-full h-full border-0"
                      title="Email content"
                    />
                  ) : (
                    <pre className="p-5 text-sm text-gray-700 whitespace-pre-wrap font-sans">
                      {selectedMessage.text}
                    </pre>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* No message selected placeholder */
          !selectedMessage && messages.length > 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
              <EnvelopeOpenIcon className="w-16 h-16 mb-3" />
              <p className="text-sm">Select a message to read</p>
            </div>
          )
        )}
      </div>

      {/* Compose modal */}
      {showCompose && (
        <ComposeModal
          accounts={accounts}
          defaultAccountId={defaultAccountId}
          activeFolder={activeFolder}
          replyTo={replyTo}
          replyAll={replyAll}
          forward={forwardMsg}
          onClose={() => setShowCompose(false)}
          onSent={() => loadMessages(currentPage)}
        />
      )}
    </div>
  );
};

export default Webmail;
