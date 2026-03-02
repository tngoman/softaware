import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PaperAirplaneIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
  XMarkIcon,
  PaperClipIcon,
  PhotoIcon,
  ArrowPathIcon,
  EllipsisVerticalIcon,
  ArrowUturnLeftIcon,
  FaceSmileIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import api from '../services/api';
import { useAppStore } from '../store';

/* ═══════════════════════════════════════════════════════════════
   Groups / Chat Page — simplified web version of desktop Groups
   Uses polling fallback (Socket.IO optional)
   ═══════════════════════════════════════════════════════════════ */

interface Group {
  id: number;
  name: string;
  description?: string;
  created_by?: string;
  created_at?: string;
  member_count?: number;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

interface Message {
  id: number;
  group_id: number;
  user_id?: number;
  user_name: string;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  file_url?: string;
  file_name?: string;
  reply_to_id?: number;
  reply_to_content?: string;
  reply_to_user?: string;
  created_at: string;
}

/* ── Create Group Dialog ─────────────────────────────────────── */
const CreateGroupDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) { setName(''); setDescription(''); }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Group name is required'); return; }
    setLoading(true);
    try {
      await api.post('/groups', { name: name.trim(), description: description.trim() });
      toast.success('Group created');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Create Group</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} required autoFocus
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., Development Team" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Optional group description…" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-6 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 disabled:opacity-50">
              {loading ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   Main Groups Page
   ═══════════════════════════════════════════════════════════ */

const GroupsPage: React.FC = () => {
  const { user } = useAppStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.get('/groups');
      const list = res.data?.data || res.data?.groups || res.data || [];
      setGroups(Array.isArray(list) ? list : []);
    } catch {
      // Groups endpoint may not exist yet — show empty state
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const fetchMessages = useCallback(async (groupId: number) => {
    setLoadingMessages(true);
    try {
      const res = await api.get(`/groups/${groupId}/messages`);
      const list = res.data?.data || res.data?.messages || res.data || [];
      setMessages(Array.isArray(list) ? list : []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  useEffect(() => {
    if (selectedGroup) {
      fetchMessages(selectedGroup.id);
      // Poll every 5s for new messages
      const iv = setInterval(() => fetchMessages(selectedGroup.id), 5000);
      return () => clearInterval(iv);
    }
  }, [selectedGroup, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !selectedGroup) return;
    setSending(true);
    try {
      await api.post(`/groups/${selectedGroup.id}/messages`, {
        content: messageText.trim(),
        message_type: 'text',
        reply_to_id: replyTo?.id || null,
      });
      setMessageText('');
      setReplyTo(null);
      fetchMessages(selectedGroup.id);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedGroup) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('message_type', file.type.startsWith('image/') ? 'image' : 'file');
    try {
      await api.post(`/groups/${selectedGroup.id}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('File sent');
      fetchMessages(selectedGroup.id);
    } catch {
      toast.error('Failed to send file');
    }
    e.target.value = '';
  };

  const handleDeleteGroup = async (group: Group) => {
    const result = await Swal.fire({
      title: 'Delete Group',
      text: `Delete "${group.name}"? All messages will be lost.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/groups/${group.id}`);
      toast.success('Group deleted');
      if (selectedGroup?.id === group.id) {
        setSelectedGroup(null);
        setMessages([]);
      }
      fetchGroups();
    } catch {
      toast.error('Failed to delete group');
    }
  };

  const filteredGroups = groups.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMessages = messages.filter(m =>
    !messageSearch || m.content?.toLowerCase().includes(messageSearch.toLowerCase()) || m.user_name?.toLowerCase().includes(messageSearch.toLowerCase())
  );

  const formatTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800000) {
      return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  };

  const isOwn = (m: Message) => String(m.user_id) === String(user?.id);

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* ── Sidebar: Group list ── */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Groups</h2>
            <button onClick={() => setShowCreateDialog(true)}
              className="p-2 rounded-lg hover:bg-gray-100 text-picton-blue" title="Create Group">
              <PlusIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search groups…" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingGroups ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-300" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-12 px-4">
              <UserGroupIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{search ? 'No matching groups' : 'No groups yet'}</p>
              {!search && (
                <button onClick={() => setShowCreateDialog(true)}
                  className="mt-2 text-sm text-picton-blue hover:underline">Create one</button>
              )}
            </div>
          ) : (
            filteredGroups.map(g => (
              <div key={g.id}
                onClick={() => setSelectedGroup(g)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b hover:bg-gray-50 transition-colors ${
                  selectedGroup?.id === g.id ? 'bg-picton-blue/5 border-l-2 border-l-picton-blue' : ''
                }`}>
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-picton-blue to-indigo-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  {g.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900 truncate">{g.name}</h4>
                    {g.last_message_at && <span className="text-[10px] text-gray-400 shrink-0">{formatTime(g.last_message_at)}</span>}
                  </div>
                  {g.last_message && <p className="text-xs text-gray-500 truncate">{g.last_message}</p>}
                  {!g.last_message && g.description && <p className="text-xs text-gray-400 truncate">{g.description}</p>}
                </div>
                {(g.unread_count || 0) > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-picton-blue text-white rounded-full shrink-0">{g.unread_count}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Main: Chat area ── */}
      <div className="flex-1 flex flex-col">
        {!selectedGroup ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <UserGroupIcon className="h-16 w-16 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Select a group to start chatting</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-picton-blue to-indigo-500 flex items-center justify-center text-white font-semibold text-sm">
                  {selectedGroup.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{selectedGroup.name}</h3>
                  {selectedGroup.member_count && <p className="text-xs text-gray-500">{selectedGroup.member_count} members</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input value={messageSearch} onChange={e => setMessageSearch(e.target.value)}
                    placeholder="Search…" className="pl-8 pr-3 py-1.5 border rounded-lg text-xs w-40" />
                </div>
                <button onClick={() => handleDeleteGroup(selectedGroup)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" title="Group options">
                  <EllipsisVerticalIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages && messages.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-300" />
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-400">{messageSearch ? 'No matching messages' : 'No messages yet. Say hello!'}</p>
                </div>
              ) : (
                filteredMessages.map(m => (
                  <div key={m.id} className={`flex ${isOwn(m) ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] group ${m.message_type === 'system' ? 'w-full text-center' : ''}`}>
                      {m.message_type === 'system' ? (
                        <p className="text-xs text-gray-400 italic py-1">{m.content}</p>
                      ) : (
                        <div className={`rounded-2xl px-4 py-2 shadow-sm ${
                          isOwn(m)
                            ? 'bg-picton-blue text-white rounded-br-md'
                            : 'bg-gray-100 text-gray-900 rounded-bl-md'
                        }`}>
                          {!isOwn(m) && (
                            <p className={`text-xs font-medium mb-0.5 ${isOwn(m) ? 'text-white/80' : 'text-picton-blue'}`}>{m.user_name}</p>
                          )}
                          {/* Reply indicator */}
                          {m.reply_to_content && (
                            <div className={`text-xs p-1.5 rounded mb-1.5 border-l-2 ${
                              isOwn(m) ? 'bg-white/10 border-l-white/40' : 'bg-gray-200 border-l-picton-blue'
                            }`}>
                              <span className="font-medium">{m.reply_to_user}</span>
                              <p className="truncate opacity-80">{m.reply_to_content}</p>
                            </div>
                          )}
                          {m.message_type === 'image' && m.file_url && (
                            <img src={m.file_url} alt="" className="rounded-lg max-w-full mb-1 max-h-48 object-cover" />
                          )}
                          {m.message_type === 'file' && m.file_url && (
                            <a href={m.file_url} target="_blank" rel="noreferrer"
                              className={`flex items-center gap-1.5 text-xs underline mb-1 ${isOwn(m) ? 'text-white/90' : 'text-picton-blue'}`}>
                              <PaperClipIcon className="h-3.5 w-3.5" /> {m.file_name || 'Download file'}
                            </a>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                          <div className={`flex items-center justify-between gap-2 mt-1 ${isOwn(m) ? 'text-white/60' : 'text-gray-400'}`}>
                            <span className="text-[10px]">{formatTime(m.created_at)}</span>
                            <button onClick={() => setReplyTo(m)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10">
                              <ArrowUturnLeftIcon className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply indicator */}
            {replyTo && (
              <div className="px-4 py-2 bg-gray-50 border-t flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Replying to {replyTo.user_name}:</span>{' '}
                  <span className="text-gray-400 truncate inline-block max-w-[300px] align-bottom">{replyTo.content}</span>
                </div>
                <button onClick={() => setReplyTo(null)} className="p-0.5 rounded hover:bg-gray-200">
                  <XMarkIcon className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            )}

            {/* Message input */}
            <div className="p-3 border-t bg-white">
              <div className="flex items-center gap-2">
                <button onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400" title="Attach file">
                  <PaperClipIcon className="h-5 w-5" />
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                <input
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Type a message…"
                  className="flex-1 px-4 py-2.5 border rounded-full text-sm focus:ring-2 focus:ring-picton-blue/30 focus:border-picton-blue"
                />
                <button onClick={handleSend} disabled={sending || !messageText.trim()}
                  className="p-2.5 rounded-full bg-picton-blue text-white hover:bg-picton-blue/90 disabled:opacity-50 transition-colors">
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <CreateGroupDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={() => fetchGroups()}
      />
    </div>
  );
};

export default GroupsPage;
