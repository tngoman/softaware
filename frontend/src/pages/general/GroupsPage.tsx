/**
 * GroupsPage — external groups chat UI.
 *
 * Connects to remote groups via Socket.IO (groupsSocket.ts).
 * Internal team chats have been moved to the Staff Chat system (/chat).
 */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type FormEvent,
} from 'react';
import { Socket } from 'socket.io-client';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { notify } from '../../utils/notify';

import { useAppStore } from '../../store';
import { createGroupsSocket } from '../../services/groupsSocket';
import {
  cacheMessages,
  getCachedMessages,
  appendCachedMessage,
} from '../../services/chatCache';
import type { CachedMessage } from '../../services/chatCache';

import {
  ChatSidebar,
  ChatHeader,
  MessageList,
  MessageInput,
} from './groups';
import type { UnifiedGroup, UnifiedMessage } from './groups';
import {
  fileToBase64,
  requestNotificationPermission,
  showBrowserNotification,
} from './groups';

// ── Convert between UnifiedMessage ↔ CachedMessage ─────────

function toCached(groupId: string, m: UnifiedMessage): CachedMessage {
  return {
    groupId,
    messageId: m.id,
    text: m.text,
    user_id: m.user_id,
    user_name: m.user_name,
    timestamp: m.timestamp,
    direction: m.direction,
    message_type: m.message_type,
    file_url: m.file_url,
    file_name: m.file_name,
    file_type: m.file_type,
    file_size: m.file_size,
    caption: m.caption,
    reply_to_message_id: m.reply_to_message_id,
    reply_to_content: m.reply_to_content,
    reply_to_user_name: m.reply_to_user_name,
  };
}

function fromCached(c: CachedMessage): UnifiedMessage {
  return {
    id: c.messageId,
    text: c.text,
    user_id: c.user_id,
    user_name: c.user_name,
    timestamp: c.timestamp,
    direction: c.direction,
    message_type: c.message_type,
    file_url: c.file_url,
    file_name: c.file_name,
    file_type: c.file_type,
    file_size: c.file_size,
    caption: c.caption,
    reply_to_message_id: c.reply_to_message_id,
    reply_to_content: c.reply_to_content,
    reply_to_user_name: c.reply_to_user_name,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Main Groups Page — External Groups Only
// ═══════════════════════════════════════════════════════════════

const GroupsPage: React.FC = () => {
  const { user } = useAppStore();

  // ── External socket ───────────────────────────────────────
  const [extSocket, setExtSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const selectedGroupRef = useRef<UnifiedGroup | null>(null);
  const seenMessageIds = useRef(new Set<string>());

  // ── Groups ────────────────────────────────────────────────
  const [externalGroups, setExternalGroups] = useState<UnifiedGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<UnifiedGroup | null>(null);
  const [groupSearch, setGroupSearch] = useState('');

  // ── Messages ──────────────────────────────────────────────
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Files ─────────────────────────────────────────────────
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [sendingFile, setSendingFile] = useState(false);

  // ── Reply ─────────────────────────────────────────────────
  const [replyingTo, setReplyingTo] = useState<UnifiedMessage | null>(null);

  // ── Search ────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ messageId: string; index: number }[]>([]);
  const [currentSearchIdx, setCurrentSearchIdx] = useState(0);

  // ── Lightbox ──────────────────────────────────────────────
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // ── Unread (GRP-010) ─────────────────────────────────────
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());

  // ── Current user identity ─────────────────────────────────
  const currentUserFullName = useMemo(() => {
    if (!user) return '';
    const first = user.first_name || '';
    const last = user.last_name || '';
    const full = `${first} ${last}`.trim();
    return full || user.username || '';
  }, [user]);

  const currentUserNameLower = useMemo(
    () => currentUserFullName.toLowerCase().trim(),
    [currentUserFullName],
  );

  // ── Keep ref in sync ──────────────────────────────────────
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // ════════════════════════════════════════════════════════════
  //  EXTERNAL GROUPS — Socket.IO
  // ════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!user) return;
    let sock: Socket | null = null;
    let cancelled = false;

    (async () => {
      sock = await createGroupsSocket();
      if (cancelled || !sock) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[GroupsPage] Could not create external socket');
        }
        return;
      }

      setExtSocket(sock);

      const joinGroups = () => {
        sock!.emit('join-groups', {
          agentId: user.id,
          agentName: currentUserFullName,
          filterByParticipation: false,
        });
      };

      sock.on('connect', () => {
        setSocketConnected(true);
        joinGroups();
      });

      sock.on('disconnect', () => setSocketConnected(false));

      // ── Group list ──
      sock.on('groups-list-updated', (updatedGroups: any[]) => {
        const unified: UnifiedGroup[] = (updatedGroups || []).map((g: any) => ({
          id: `ext_${g.whatsapp_group_id}`,
          name: g.group_name,
          last_message: g.last_message || undefined,
          timestamp: g.timestamp || 0,
          unread_count: 0,
        }));
        setExternalGroups(unified);
      });

      // ── New message (real-time) ──
      sock.on('new-group-message', (msg: any) => {
        const currentGroup = selectedGroupRef.current;
        const extId = `ext_${msg.channelId}`;
        const isCurrentGroup = currentGroup && currentGroup.id === extId;

        if (!isCurrentGroup) {
          const title = msg.userName || msg.name || 'New group message';
          const body = msg.message || msg.content || 'New message received';
          showBrowserNotification(title, body, `group-${msg.channelId}`);
          notify.info(body);

          // GRP-010: Increment unread
          setUnreadCounts((prev) => {
            const next = new Map(prev);
            next.set(extId, (next.get(extId) ?? 0) + 1);
            return next;
          });
        }

        // Update group last_message
        setExternalGroups((prev) =>
          prev.map((g) =>
            g.id === extId
              ? { ...g, last_message: msg.message || msg.content, timestamp: msg.timestamp }
              : g,
          ),
        );

        if (isCurrentGroup) {
          const messageId = msg.id || msg.message_id || `${msg.timestamp}_${Date.now()}`;
          if (seenMessageIds.current.has(messageId)) return;
          seenMessageIds.current.add(messageId);

          const unified: UnifiedMessage = {
            id: messageId,
            text: msg.message || msg.content || msg.caption || '',
            user_id: msg.userId || msg.user_id,
            user_name: msg.userName || msg.name || 'Unknown',
            timestamp: msg.timestamp,
            direction: msg.direction,
            message_type: msg.message_type,
            file_url: msg.file_url,
            file_name: msg.file_name,
            file_type: msg.file_type,
            file_size: msg.file_size,
            caption: msg.caption,
            reply_to_message_id: msg.reply_to_message_id,
          };

          setMessages((prev) => [...prev, unified]);
          appendCachedMessage(extId, toCached(extId, unified));
          setTimeout(scrollToBottom, 100);
        }
      });

      // ── Channel messages (batch load) ──
      sock.on('groups-channel-messages', (msgs: any[]) => {
        if (!Array.isArray(msgs)) return;
        seenMessageIds.current.clear();
        const formatted: UnifiedMessage[] = msgs.map((m) => {
          const id = m.id || m.message_id;
          seenMessageIds.current.add(id);
          return {
            id,
            text: m.message || m.content || m.caption || '',
            user_id: m.userId || m.user_id,
            user_name: m.userName || m.name || 'Unknown',
            timestamp: m.timestamp,
            direction: m.direction,
            message_type: m.message_type,
            file_url: m.file_url,
            file_name: m.file_name,
            file_type: m.file_type,
            file_size: m.file_size,
            caption: m.caption,
            reply_to_message_id: m.reply_to_message_id,
          };
        });
        setMessages(formatted);
        setLoadingMessages(false);

        // GRP-008: Cache these messages
        const currentGroup = selectedGroupRef.current;
        if (currentGroup) {
          cacheMessages(
            currentGroup.id,
            formatted.map((m) => toCached(currentGroup.id, m)),
          );
        }

        setTimeout(scrollToBottom, 100);
      });

      if (sock.connected) {
        setSocketConnected(true);
        joinGroups();
      }
    })();

    return () => {
      cancelled = true;
      if (sock) {
        sock.disconnect();
        setExtSocket(null);
        setSocketConnected(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ════════════════════════════════════════════════════════════
  //  SEARCH IN CHAT
  // ════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIdx(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = messages
      .map((msg, i) => ({ messageId: msg.id, index: i, text: msg.text || '', userName: msg.user_name || '' }))
      .filter((item) => item.text.toLowerCase().includes(q) || item.userName.toLowerCase().includes(q));
    setSearchResults(results);
    setCurrentSearchIdx(results.length > 0 ? 0 : -1);
  }, [searchQuery, messages]);

  useEffect(() => {
    if (searchResults.length > 0 && currentSearchIdx >= 0) {
      const result = searchResults[currentSearchIdx];
      document
        .getElementById(`group-message-${result.messageId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSearchIdx, searchResults]);

  const searchNext = useCallback(() => {
    if (searchResults.length > 0)
      setCurrentSearchIdx((p) => (p + 1) % searchResults.length);
  }, [searchResults.length]);

  const searchPrev = useCallback(() => {
    if (searchResults.length > 0)
      setCurrentSearchIdx((p) => (p - 1 + searchResults.length) % searchResults.length);
  }, [searchResults.length]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIdx(0);
  }, []);

  // ════════════════════════════════════════════════════════════
  //  GROUP SELECTION
  // ════════════════════════════════════════════════════════════

  const handleGroupSelect = useCallback(
    async (group: UnifiedGroup) => {
      setSelectedGroup(group);
      setSearchQuery('');
      setSearchResults([]);
      setReplyingTo(null);
      setAttachedFiles([]);

      // GRP-010: Clear unread for this group
      setUnreadCounts((prev) => {
        const next = new Map(prev);
        next.delete(group.id);
        return next;
      });

      // GRP-008: Show cached messages immediately
      const cached = await getCachedMessages(group.id);
      if (cached.length > 0) {
        setMessages(cached.map(fromCached));
        setLoadingMessages(false);
        setTimeout(scrollToBottom, 50);
      } else {
        setMessages([]);
        setLoadingMessages(true);
      }

      // Request messages via socket
      if (extSocket && user) {
        const whatsappId = group.id.replace('ext_', '');
        extSocket.emit('groups-set-channel', { agentId: user.id, channelId: whatsappId });
      }
      if (cached.length === 0) setLoadingMessages(true);
    },
    [extSocket, user, scrollToBottom],
  );

  // ════════════════════════════════════════════════════════════
  //  SEND MESSAGE
  // ════════════════════════════════════════════════════════════

  const sendMessage = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const hasText = newMessage.trim();
      const hasFiles = attachedFiles.length > 0;

      if ((!hasText && !hasFiles) || sendingMessage || !user || !selectedGroup) return;

      setSendingMessage(true);
      try {
        if (!extSocket) {
          notify.error('Socket not connected');
          return;
        }
        const senderName = currentUserFullName || user.username;
        const channelId = selectedGroup.id.replace('ext_', '');

        if (hasFiles) {
          setSendingFile(true);
          for (const file of attachedFiles) {
            const base64 = await fileToBase64(file);
            extSocket.emit('send-group-file', {
              channelId,
              file: { name: file.name, type: file.type, size: file.size, base64 },
              caption: hasText ? newMessage.trim() : '',
              agentId: user.id,
              agentName: senderName,
              replyToId: replyingTo?.id || null,
            });
          }
          setAttachedFiles([]);
          setSendingFile(false);
        } else if (hasText) {
          extSocket.emit('send-group-message', {
            channelId,
            message: newMessage.trim(),
            agentId: user.id,
            agentName: senderName,
            replyToId: replyingTo?.id || null,
          });
        }

        setNewMessage('');
        setReplyingTo(null);
        setTimeout(scrollToBottom, 100);
      } catch (err) {
        console.error('Error sending message:', err);
        notify.error('Failed to send message');
      } finally {
        setSendingMessage(false);
        setSendingFile(false);
      }
    },
    [newMessage, attachedFiles, sendingMessage, user, selectedGroup, extSocket, currentUserFullName, replyingTo, scrollToBottom],
  );

  // ════════════════════════════════════════════════════════════
  //  FILTERED GROUP LIST
  // ════════════════════════════════════════════════════════════

  const filteredGroups = useMemo(() => {
    let groups = externalGroups.map((g) => ({
      ...g,
      unread_count: unreadCounts.get(g.id) ?? g.unread_count ?? 0,
    }));

    if (groupSearch.trim()) {
      const q = groupSearch.toLowerCase();
      groups = groups.filter((g) => g.name.toLowerCase().includes(q));
    }

    // Sort: most recent first
    groups.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return groups;
  }, [externalGroups, groupSearch, unreadCounts]);

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* ──────── Sidebar ──────── */}
      <ChatSidebar
        groups={filteredGroups}
        selectedGroup={selectedGroup}
        onSelectGroup={handleGroupSelect}
        socketConnected={socketConnected}
        groupSearch={groupSearch}
        onGroupSearchChange={setGroupSearch}
      />

      {/* ──────── Chat area ──────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedGroup ? (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <ChatBubbleLeftRightIcon className="h-16 w-16 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Select a group to start chatting</p>
            </div>
          </div>
        ) : (
          <>
            <ChatHeader
              selectedGroup={selectedGroup}
              socketConnected={socketConnected}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              searchResults={searchResults}
              currentSearchIdx={currentSearchIdx}
              onSearchNext={searchNext}
              onSearchPrev={searchPrev}
              onClearSearch={clearSearch}
            />

            <MessageList
              messages={messages}
              selectedGroup={selectedGroup}
              loadingMessages={loadingMessages}
              currentUserNameLower={currentUserNameLower}
              searchQuery={searchQuery}
              searchResults={searchResults}
              currentSearchIdx={currentSearchIdx}
              onReply={setReplyingTo}
              onLightbox={setLightboxSrc}
              lightboxSrc={lightboxSrc}
              onCloseLightbox={() => setLightboxSrc(null)}
              messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
            />

            <MessageInput
              newMessage={newMessage}
              onMessageChange={setNewMessage}
              attachedFiles={attachedFiles}
              onFilesChange={setAttachedFiles}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              sendingMessage={sendingMessage}
              sendingFile={sendingFile}
              onSend={sendMessage}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default GroupsPage;
