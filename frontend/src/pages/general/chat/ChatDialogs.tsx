import React, { useState, useEffect, useRef } from 'react';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
  UsersIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';
import { StaffChatModel, type AvailableUser } from '../../../models/StaffChatModel';
import { getInitials, getFileUrl, fileToBase64 } from './chatHelpers';
import { notify } from '../../../utils/notify';

/* ------------------------------------------------------------------ */
/*  New DM Dialog                                                       */
/* ------------------------------------------------------------------ */
interface NewDMDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: number) => void;
}

export function NewDMDialog({ open, onClose, onCreated }: NewDMDialogProps) {
  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      StaffChatModel.getAvailableUsers()
        .then(setUsers)
        .catch(() => notify.error('Failed to load users'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  if (!open) return null;

  const filtered = users.filter((u) =>
    u.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = async (userId: string) => {
    try {
      setCreating(userId);
      const conv = await StaffChatModel.createConversation({
        type: 'direct',
        member_ids: [userId],
      });
      onCreated(conv.id);
      onClose();
    } catch {
      notify.error('Failed to create conversation');
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">New Message</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 pb-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search people..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No users found</p>
          )}
          {filtered.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user.id)}
              disabled={creating === user.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {user.avatar_url ? (
                <img src={getFileUrl(user.avatar_url)} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">
                  {getInitials(user.display_name)}
                </div>
              )}
              <div className="text-left min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{user.display_name}</p>
                {user.email && <p className="text-xs text-gray-500 truncate">{user.email}</p>}
              </div>
              {creating === user.id && (
                <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  New Group Dialog                                                    */
/* ------------------------------------------------------------------ */
interface NewGroupDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: number) => void;
}

export function NewGroupDialog({ open, onClose, onCreated }: NewGroupDialogProps) {
  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AvailableUser[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<'members' | 'details'>('members');

  useEffect(() => {
    if (open) {
      setLoading(true);
      setStep('members');
      setSelected([]);
      setGroupName('');
      setSearch('');
      StaffChatModel.getAvailableUsers()
        .then(setUsers)
        .catch(() => notify.error('Failed to load users'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  if (!open) return null;

  const filtered = users.filter((u) =>
    u.display_name.toLowerCase().includes(search.toLowerCase()) &&
    !selected.find((s) => s.id === u.id)
  );

  const toggleUser = (user: AvailableUser) => {
    setSelected((prev) =>
      prev.find((s) => s.id === user.id)
        ? prev.filter((s) => s.id !== user.id)
        : [...prev, user]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      notify.error('Please enter a group name');
      return;
    }
    if (selected.length < 1) {
      notify.error('Select at least one member');
      return;
    }
    try {
      setCreating(true);
      const conv = await StaffChatModel.createConversation({
        type: 'group',
        name: groupName.trim(),
        member_ids: selected.map((u) => u.id),
      });
      onCreated(conv.id);
      onClose();
    } catch {
      notify.error('Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {step === 'members' ? 'Select Members' : 'Group Details'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {step === 'members' ? (
          <>
            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-4 pb-0">
                {selected.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {user.display_name.split(' ')[0]}
                    <button onClick={() => toggleUser(user)}>
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="p-4 pb-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search people..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {loading && (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {filtered.map((user) => (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50"
                >
                  {user.avatar_url ? (
                    <img src={getFileUrl(user.avatar_url)} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">
                      {getInitials(user.display_name)}
                    </div>
                  )}
                  <p className="text-sm font-medium text-gray-900 truncate flex-1 text-left">{user.display_name}</p>
                </button>
              ))}
            </div>

            {/* Next button */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setStep('details')}
                disabled={selected.length < 1}
                className="w-full py-2.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next ({selected.length} selected)
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Group name input */}
            <div className="p-6 space-y-4">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <UsersIcon className="w-8 h-8 text-emerald-600" />
                </div>
                <input
                  type="text"
                  placeholder="Group name..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  autoFocus
                  maxLength={100}
                  className="w-full text-center text-lg font-medium border-b-2 border-gray-200 focus:border-blue-500 outline-none pb-2"
                />
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-2">Members ({selected.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.map((u) => (
                    <span key={u.id} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                      {u.display_name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setStep('members')}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={!groupName.trim() || creating}
                className="flex-1 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Create Group
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Members Dialog (for existing group)                             */
/* ------------------------------------------------------------------ */
interface AddMembersDialogProps {
  open: boolean;
  conversationId: number;
  existingMemberIds: string[];
  onClose: () => void;
  onAdded: () => void;
}

export function AddMembersDialog({
  open,
  conversationId,
  existingMemberIds,
  onClose,
  onAdded,
}: AddMembersDialogProps) {
  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setSelected([]);
      setSearch('');
      StaffChatModel.getAvailableUsers()
        .then((all: AvailableUser[]) => setUsers(all.filter((u: AvailableUser) => !existingMemberIds.includes(u.id))))
        .catch(() => notify.error('Failed to load users'))
        .finally(() => setLoading(false));
    }
  }, [open, existingMemberIds]);

  if (!open) return null;

  const filtered = users.filter((u) =>
    u.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAdd = async () => {
    if (selected.length === 0) return;
    try {
      setAdding(true);
      await StaffChatModel.addMembers(conversationId, selected);
      notify.success(`Added ${selected.length} member(s)`);
      onAdded();
      onClose();
    } catch {
      notify.error('Failed to add members');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Add Members</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 pb-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search people..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No users available to add</p>
          ) : (
            filtered.map((user) => (
              <button
                key={user.id}
                onClick={() => toggleUser(user.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  selected.includes(user.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                {user.avatar_url ? (
                  <img src={getFileUrl(user.avatar_url)} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">
                    {getInitials(user.display_name)}
                  </div>
                )}
                <p className="text-sm font-medium text-gray-900 flex-1 text-left truncate">{user.display_name}</p>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selected.includes(user.id)
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {selected.includes(user.id) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleAdd}
            disabled={selected.length === 0 || adding}
            className="w-full py-2.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {adding && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            Add {selected.length > 0 ? `(${selected.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Conversation Info Panel                                             */
/* ------------------------------------------------------------------ */
interface ConversationInfoProps {
  open: boolean;
  conversation: {
    id: number;
    type: string;
    name: string | null;
    description: string | null;
    icon_url: string | null;
    created_by: string;
    member_count?: number;
  } | null;
  members: { user_id: string; name: string; role: string; avatar_url?: string }[];
  currentUserId: string;
  onClose: () => void;
  onAddMembers: () => void;
  onRemoveMember: (userId: string) => void;
  onLeave: () => void;
  onUpdateIcon?: (iconUrl: string) => void;
}

type MediaTab = 'media' | 'docs' | 'links';

function MediaGallery({ conversationId }: { conversationId: number }) {
  const [tab, setTab] = useState<MediaTab>('media');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const typeMap: Record<MediaTab, string> = { media: 'images', docs: 'files', links: 'links' };
    StaffChatModel.getMedia(conversationId, typeMap[tab])
      .then((data) => { if (mounted) setItems(data); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [conversationId, tab]);

  return (
    <div className="border-t border-gray-100">
      {/* Tab bar */}
      <div className="flex border-b border-gray-100">
        {(['media', 'docs', 'links'] as MediaTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              tab === t
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t === 'media' ? '🖼 Media' : t === 'docs' ? '📄 Docs' : '🔗 Links'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-3 min-h-[120px]">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">
            No {tab === 'media' ? 'media' : tab === 'docs' ? 'documents' : 'links'} shared yet
          </p>
        ) : tab === 'media' ? (
          <div className="grid grid-cols-3 gap-1.5">
            {items.map((item: any, i: number) => (
              <a
                key={item.id || i}
                href={getFileUrl(item.file_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-80 transition-opacity"
              >
                <img
                  src={getFileUrl(item.thumbnail_url || item.file_url)}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        ) : tab === 'docs' ? (
          <div className="space-y-1.5">
            {items.map((item: any, i: number) => (
              <a
                key={item.id || i}
                href={getFileUrl(item.file_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 rounded bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-500 flex-shrink-0">
                  {(item.file_name || 'FILE').split('.').pop()?.toUpperCase()?.slice(0, 4) || 'FILE'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-700 truncate">{item.file_name || 'Document'}</p>
                  <p className="text-xs text-gray-400">
                    {item.file_size ? `${(item.file_size / 1024).toFixed(1)} KB` : ''}
                    {item.created_at ? ` · ${new Date(item.created_at).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {items.map((item: any, i: number) => {
              // Try to extract URL from content
              const urlMatch = (item.content || '').match(/(https?:\/\/[^\s]+)/);
              const url = urlMatch ? urlMatch[1] : '#';
              return (
                <a
                  key={item.id || i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="text-sm text-blue-600 truncate">{url}</p>
                  <p className="text-xs text-gray-400 truncate">{item.content}</p>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConversationInfo({
  open,
  conversation,
  members,
  currentUserId,
  onClose,
  onAddMembers,
  onRemoveMember,
  onLeave,
  onUpdateIcon,
}: ConversationInfoProps) {
  const iconInputRef = useRef<HTMLInputElement>(null);

  if (!open || !conversation) return null;

  const isGroup = conversation.type === 'group';
  const isAdmin = members.find((m) => m.user_id === currentUserId)?.role === 'admin';

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateIcon) return;
    if (!file.type.startsWith('image/')) {
      notify.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify.error('Image must be under 5MB');
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      const result = await StaffChatModel.uploadFile(conversation.id, {
        file_name: file.name,
        file_type: file.type,
        file_data: base64,
      });
      await StaffChatModel.updateConversation(conversation.id, { icon_url: result.file_url });
      onUpdateIcon(result.file_url);
      notify.success('Group icon updated');
    } catch {
      notify.error('Failed to upload icon');
    }
    if (iconInputRef.current) iconInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-md mx-0 sm:mx-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isGroup ? 'Group Info' : 'Contact Info'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Group details */}
          <div className="p-6 text-center border-b border-gray-100">
            <div className="relative inline-block">
              {conversation.icon_url ? (
                <img
                  src={getFileUrl(conversation.icon_url)}
                  alt=""
                  className="w-16 h-16 rounded-full object-cover mx-auto"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <UsersIcon className="w-8 h-8 text-emerald-600" />
                </div>
              )}
              {isGroup && isAdmin && (
                <>
                  <button
                    onClick={() => iconInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md hover:bg-blue-600 transition-colors"
                    title="Change group icon"
                  >
                    <CameraIcon className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={iconInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleIconUpload}
                    className="hidden"
                  />
                </>
              )}
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mt-3">{conversation.name || 'Unnamed'}</h4>
            {conversation.description && (
              <p className="text-sm text-gray-500 mt-1">{conversation.description}</p>
            )}
            {isGroup && (
              <p className="text-xs text-gray-400 mt-1">{members.length} members</p>
            )}
          </div>

          {/* Media Gallery Tabs */}
          <MediaGallery conversationId={conversation.id} />

          {/* Members */}
          {isGroup && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-semibold text-gray-700">Members</h5>
                {isAdmin && (
                  <button
                    onClick={onAddMembers}
                    className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                  >
                    <UserPlusIcon className="w-4 h-4" />
                    Add
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-3 px-2 py-2 rounded-lg">
                    {m.avatar_url ? (
                      <img src={getFileUrl(m.avatar_url)} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                        {getInitials(m.name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {m.name}{m.user_id === currentUserId ? ' (You)' : ''}
                      </p>
                      {m.role === 'admin' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">
                          Admin
                        </span>
                      )}
                      {m.role === 'member' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                          Member
                        </span>
                      )}
                    </div>
                    {isAdmin && m.user_id !== currentUserId && (
                      <button
                        onClick={() => onRemoveMember(m.user_id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Leave button */}
        {isGroup && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onLeave}
              className="w-full py-2.5 text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50"
            >
              Leave Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
