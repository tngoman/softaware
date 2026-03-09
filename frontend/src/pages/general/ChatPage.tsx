/**
 * ChatPage — Orchestrator for the staff-chat system.
 *
 * Wires together:
 *   • ChatSidebar  – conversation list
 *   • ChatHeader   – conversation header bar
 *   • MessageList   – scrolling message list
 *   • MessageInput  – compose / edit / reply / attach
 *   • Dialogs       – new DM, new group, add members, info panel
 *   • Socket.IO     – /chat namespace for real-time events
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { notify } from '../../utils/notify';
import Swal from 'sweetalert2';

import { useAppStore } from '../../store';
import {
  StaffChatModel,
  type Conversation,
  type ChatMessage,
  type ConversationMember,
  type GifResult,
  type ScheduledCall,
} from '../../models/StaffChatModel';
import {
  getStaffChatSocket,
  disconnectStaffChatSocket,
  emitTyping,
  emitStopTyping,
  joinConversationRoom,
  leaveConversationRoom,
  emitCallInitiate,
  emitCallAccept,
  emitCallDecline,
  emitCallEnd,
  emitCallParticipantUpdate,
} from '../../services/staffChatSocket';

import {
  enqueueMessage,
  getQueuedMessages,
  dequeueMessage,
} from '../../services/chatOfflineQueue';

import { webrtcService, type CallState } from '../../services/webrtcService';
import { stopRinging } from '../../utils/ringtone';

import {
  ChatSidebar,
  ChatHeader,
  MessageList,
  MessageInput,
  StarredMessagesPanel,
  ForwardDialog,
  GlobalSearchPanel,
  NewDMDialog,
  NewGroupDialog,
  AddMembersDialog,
  ConversationInfo,
  CallOverlay,
  IncomingCallModal,
  CallHistoryPanel,
  ScheduleCallDialog,
  ScheduledCallsPanel,
  compressImage,
} from './chat';

/* ================================================================== */
/*  ChatPage                                                           */
/* ================================================================== */
export default function ChatPage() {
  const user = useAppStore((s) => s.user);
  const userId = String(user?.id || '');

  /* ---- core state ---- */
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());

  /* ---- loading / pagination ---- */
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const PAGE_SIZE = 50;

  /* ---- UI state ---- */
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editMsg, setEditMsg] = useState<ChatMessage | null>(null);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSearchInChat, setShowSearchInChat] = useState(false);
  const [showStarred, setShowStarred] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [lastReadId, setLastReadId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);

  /* ---- presence / typing ---- */
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingMap, setTypingMap] = useState<Map<number, string[]>>(new Map());
  const typingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /* ---- call state ---- */
  const [callState, setCallState] = useState<CallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    callId: number;
    conversationId: number;
    callType: 'voice' | 'video';
    callerId: string;
    callerName: string;
  } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [showScheduleCall, setShowScheduleCall] = useState(false);
  const [showScheduledCalls, setShowScheduledCalls] = useState(false);
  const [editingScheduledCall, setEditingScheduledCall] = useState<ScheduledCall | null>(null);

  /* ---- reconnect sync refs ---- */
  const lastSyncRef = useRef<string>(new Date().toISOString());
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  /* ================================================================ */
  /*  Socket setup                                                      */
  /* ================================================================ */
  useEffect(() => {
    const socket = getStaffChatSocket();

    /* — new message — */
    socket.on('new_message', (msg: ChatMessage & { conversation_id: number }) => {
      // Add to messages if in selected conversation
      const sel = selectedRef.current;
      if (sel && msg.conversation_id === sel.id) {
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Mark read
        StaffChatModel.markRead(msg.conversation_id).catch(() => {});
      }
      // Update conversation list (bump to top, update last_message)
      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id === msg.conversation_id) {
            return {
              ...c,
              last_message_content: msg.content,
              last_message_type: msg.message_type,
              last_message_at: msg.created_at,
              unread_count:
                sel?.id === msg.conversation_id
                  ? 0
                  : c.unread_count + 1,
            };
          }
          return c;
        });
        // Sort: pinned first, then by last_message_at desc
        return updated.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(b.last_message_at || b.created_at).getTime() -
            new Date(a.last_message_at || a.created_at).getTime();
        });
      });
    });

    /* — message edited — */
    socket.on('message_edited', (data: { message_id: number; content: string; edited_at: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.message_id
            ? { ...m, content: data.content, edited_at: data.edited_at }
            : m
        )
      );
    });

    /* — message deleted — */
    socket.on('message_deleted', (data: { message_id: number }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
    });

    /* — reaction update — */
    socket.on('reaction_update', (data: {
      message_id: number;
      reactions: any[];
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.message_id ? { ...m, reactions: data.reactions } : m
        )
      );
    });

    /* — conversation updated — */
    socket.on('conversation_updated', (data: Partial<Conversation> & { id: number; _link_preview?: { messageId: number; preview: any } }) => {
      // Handle link preview updates piggybacked on conversation_updated
      if (data._link_preview) {
        const { messageId, preview } = data._link_preview;
        setMessages((prev) =>
          prev.map((m) => m.id === messageId ? { ...m, link_preview: preview } : m)
        );
        return; // Don't spread _link_preview onto the conversation object
      }

      setConversations((prev) =>
        prev.map((c) => (c.id === data.id ? { ...c, ...data } : c))
      );
      if (selectedRef.current?.id === data.id) {
        setSelected((prev) => (prev ? { ...prev, ...data } : prev));
      }
    });

    /* — conversation deleted — */
    socket.on('conversation_deleted', (data: { conversation_id: number }) => {
      setConversations((prev) => prev.filter((c) => c.id !== data.conversation_id));
      if (selectedRef.current?.id === data.conversation_id) {
        setSelected(null);
        setMessages([]);
      }
    });

    /* — message status — */
    socket.on('message_status', (data: {
      message_id: number;
      status: ChatMessage['status'];
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.message_id ? { ...m, status: data.status } : m
        )
      );
    });

    /* — typing — */
    socket.on('user_typing', (data: { conversation_id: number; user_id: string; user_name: string }) => {
      if (data.user_id === userId) return;
      setTypingMap((prev) => {
        const next = new Map(prev);
        const list = next.get(data.conversation_id) || [];
        if (!list.includes(data.user_name)) {
          next.set(data.conversation_id, [...list, data.user_name]);
        }
        return next;
      });
      // Auto-clear after 3s
      const key = `${data.conversation_id}-${data.user_id}`;
      if (typingTimers.current.has(key)) clearTimeout(typingTimers.current.get(key)!);
      typingTimers.current.set(
        key,
        setTimeout(() => {
          setTypingMap((prev) => {
            const next = new Map(prev);
            const list = (next.get(data.conversation_id) || []).filter((n) => n !== data.user_name);
            if (list.length === 0) next.delete(data.conversation_id);
            else next.set(data.conversation_id, list);
            return next;
          });
        }, 3000)
      );
    });

    socket.on('user_stop_typing', (data: { conversation_id: number; user_id: string; user_name: string }) => {
      setTypingMap((prev) => {
        const next = new Map(prev);
        const list = (next.get(data.conversation_id) || []).filter((n) => n !== data.user_name);
        if (list.length === 0) next.delete(data.conversation_id);
        else next.set(data.conversation_id, list);
        return next;
      });
    });

    /* — presence — */
    socket.on('presence_update', (data: { user_id: string; status: string }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (data.status === 'online') next.add(data.user_id);
        else next.delete(data.user_id);
        return next;
      });
    });

    /* — reconnect catch-up — */
    socket.on('connect', () => {
      // On reconnect, sync missed messages
      const lastTs = lastSyncRef.current;
      if (lastTs) {
        StaffChatModel.sync(lastTs).then((syncData) => {
          if (syncData.new_messages.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const fresh = syncData.new_messages.filter((m) => !existingIds.has(m.id));
              return [...prev, ...fresh].sort((a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          }
          if (syncData.edited_messages.length > 0) {
            setMessages((prev) =>
              prev.map((m) => {
                const edit = syncData.edited_messages.find((e) => e.id === m.id);
                return edit ? { ...m, content: edit.content, edited_at: edit.edited_at } : m;
              })
            );
          }
          if (syncData.deleted_message_ids.length > 0) {
            const deletedSet = new Set(syncData.deleted_message_ids);
            setMessages((prev) => prev.filter((m) => !deletedSet.has(m.id)));
          }
          // Refresh conversation list
          StaffChatModel.getConversations().then((convs) => {
            setConversations(convs);
          }).catch(() => {});
        }).catch(() => {});
      }
      lastSyncRef.current = new Date().toISOString();

      // Re-join current conversation room and wait for it
      if (selectedRef.current) {
        joinConversationRoom(selectedRef.current.id).catch((err) => {
          console.error('[ChatPage] Failed to rejoin conversation room on reconnect', err);
        });
      }

      // Flush offline message queue
      flushOfflineQueue();
    });

    /* ── Call signaling events ──────────────────────────── */

    /** Incoming call ringing */
    socket.on('call-ringing', (data: {
      callId: number;
      conversationId: number;
      callType: 'voice' | 'video';
      callerId: string;
      callerName: string;
    }) => {
      // Don't show if we're the caller or already in a call
      if (data.callerId === userId) return;
      if (webrtcService.isInCall()) return;
      setIncomingCall(data);
    });

    /** Call accepted by someone */
    socket.on('call-accepted', (data: {
      callId: number;
      conversationId: number;
      userId: string;
    }) => {
      if (data.userId === userId) return; // We accepted — already handled
      const cs = webrtcService.getCallState();
      if (cs && cs.callId === data.callId) {
        // Someone accepted our outgoing call.
        // Do NOT eagerly create a PeerConnection here — the acceptor will
        // send us a webrtc-offer, and handleOffer will create the PC at
        // the right time (after which it can properly set remoteDescription
        // and flush queued ICE candidates).  Creating a PC here races with
        // handleOffer and causes duplicate/orphaned PeerConnections.
        console.log('[Call] call-accepted received, waiting for webrtc-offer from', data.userId);
      }
    });

    /** Call declined by someone */
    socket.on('call-declined', (data: {
      callId: number;
      conversationId: number;
      userId: string;
      reason: string;
    }) => {
      // If this was our incoming call prompt, close it
      if (incomingCall?.callId === data.callId && data.userId !== userId) {
        // Another participant declined
      }
    });

    /** Call ended */
    socket.on('call-ended', (data: {
      callId: number;
      conversationId: number;
      endedBy: string;
      durationSeconds: number;
    }) => {
      setIncomingCall(null);
      webrtcService.endCall();
    });

    /** Call missed */
    socket.on('call-missed', (data: { callId: number; conversationId: number }) => {
      setIncomingCall((prev) => prev?.callId === data.callId ? null : prev);
      const cs = webrtcService.getCallState();
      if (cs && cs.callId === data.callId) {
        webrtcService.endCall();
        notify.info('📞 Call was not answered');
      }
    });

    /** WebRTC SDP offer received */
    socket.on('webrtc-offer', (data: {
      callId: number;
      conversationId: number;
      fromUserId: string;
      targetUserId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      if (data.targetUserId !== userId) return;
      webrtcService.handleOffer(data.fromUserId, data.sdp, socket).catch((err) => {
        console.error('[Call] Failed to handle offer', err);
      });
    });

    /** WebRTC SDP answer received */
    socket.on('webrtc-answer', (data: {
      callId: number;
      conversationId: number;
      fromUserId: string;
      targetUserId: string;
      sdp: RTCSessionDescriptionInit;
    }) => {
      if (data.targetUserId !== userId) return;
      webrtcService.handleAnswer(data.fromUserId, data.sdp).catch((err) => {
        console.error('[Call] Failed to handle answer', err);
      });
    });

    /** ICE candidate received */
    socket.on('webrtc-ice-candidate', (data: {
      callId: number;
      conversationId: number;
      fromUserId: string;
      targetUserId: string;
      candidate: RTCIceCandidateInit;
    }) => {
      if (data.targetUserId !== userId) return;
      webrtcService.handleIceCandidate(data.fromUserId, data.candidate).catch((err) => {
        console.error('[Call] Failed to handle ICE candidate', err);
      });
    });

    /** Participant state update (mute/camera) */
    socket.on('call-participant-updated', (data: {
      callId: number;
      conversationId: number;
      userId: string;
      muted?: boolean;
      cameraOff?: boolean;
    }) => {
      webrtcService.updateParticipant(data.userId, {
        muted: data.muted,
        cameraOff: data.cameraOff,
      });
    });

    /** Scheduled call events (created, updated, cancelled, reminder) */
    socket.on('scheduled-call', (data: { type: string; title?: string; [key: string]: any }) => {
      if (data.type === 'created' && data.title) {
        notify.info(`📅 New call scheduled: "${data.title}"`);
      } else if (data.type === 'cancelled') {
        notify.warning('❌ A scheduled call was cancelled');
      } else if (data.type === 'reminder' && data.title) {
        notify.warning(`⏰ "${data.title}" starts in 15 minutes`);
      }
    });

    return () => {
      socket.off('new_message');
      socket.off('message_edited');
      socket.off('message_deleted');
      socket.off('reaction_update');
      socket.off('conversation_updated');
      socket.off('conversation_deleted');
      socket.off('message_status');
      socket.off('user_typing');
      socket.off('user_stop_typing');
      socket.off('presence_update');
      socket.off('connect');
      socket.off('call-ringing');
      socket.off('call-accepted');
      socket.off('call-declined');
      socket.off('call-ended');
      socket.off('call-missed');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('call-participant-updated');
      socket.off('scheduled-call');
      // NOTE: Do NOT call disconnectStaffChatSocket() here.
      // The socket is shared with GlobalCallProvider in Layout and must persist.
      // It will be cleaned up when the user logs out.
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* ================================================================ */
  /*  Load conversations                                                */
  /* ================================================================ */
  useEffect(() => {
    let mounted = true;
    setLoadingConvs(true);
    StaffChatModel.getConversations()
      .then((data: Conversation[]) => {
        if (mounted) setConversations(data);
      })
      .catch(() => notify.error('Failed to load conversations'))
      .finally(() => { if (mounted) setLoadingConvs(false); });

    // Load starred message IDs
    StaffChatModel.getStarredMessages()
      .then((stars: { id: number }[]) => {
        if (mounted) setStarredIds(new Set(stars.map((s) => s.id)));
      })
      .catch(() => {});

    return () => { mounted = false; };
  }, []);

  /* ================================================================ */
  /*  Load messages when conversation changes                           */
  /* ================================================================ */
  const loadMessages = useCallback(async (convId: number, before?: string) => {
    setLoadingMsgs(true);
    try {
      const data = await StaffChatModel.getMessages(convId, { limit: PAGE_SIZE, before });
      if (!before) {
        // Initial load
        setMessages(data);
        setHasMore(data.length >= PAGE_SIZE);
        setCursor(data.length > 0 ? data[0].created_at : undefined);
        // Mark as read
        StaffChatModel.markRead(convId).catch(() => {});
        // Reset unread in sidebar
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
        );
      } else {
        // Prepend older messages
        setMessages((prev) => [...data, ...prev]);
        setHasMore(data.length >= PAGE_SIZE);
        setCursor(data.length > 0 ? data[0].created_at : undefined);
      }
    } catch {
      notify.error('Failed to load messages');
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const selectConversation = useCallback(async (conv: Conversation) => {
    // Leave old room
    if (selected) {
      try {
        await leaveConversationRoom(selected.id);
      } catch (err) {
        console.error('[ChatPage] Failed to leave conversation room', err);
      }
      emitStopTyping(selected.id);
    }

    setSelected(conv);
    setMessages([]);
    setReplyTo(null);
    setEditMsg(null);
    setMobileShowChat(true);
    setCursor(undefined);
    // Track the last read message for the "New Messages" divider
    setLastReadId(conv.last_read_message_id ?? null);

    // Join new room and wait for confirmation
    try {
      await joinConversationRoom(conv.id);
    } catch (err) {
      console.error('[ChatPage] Failed to join conversation room', err);
    }
    
    loadMessages(conv.id);

    // Load members for group info
    StaffChatModel.getConversation(conv.id)
      .then((detail: any) => {
        if (detail.members) setMembers(detail.members);
      })
      .catch(() => {});
  }, [selected, loadMessages]);

  const handleLoadMore = useCallback(() => {
    if (selected && cursor && !loadingMsgs) {
      loadMessages(selected.id, cursor);
    }
  }, [selected, cursor, loadingMsgs, loadMessages]);

  /* ================================================================ */
  /*  Service worker notification click → navigate to conversation      */
  /* ================================================================ */
  useEffect(() => {
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        const { conversationId } = event.data.payload || {};
        if (conversationId) {
          setConversations((prev) => {
            const conv = prev.find((c) => c.id === Number(conversationId));
            if (conv) setTimeout(() => selectConversation(conv), 0);
            return prev;
          });
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [selectConversation]);

  /* ================================================================ */
  /*  Offline message queue flush                                       */
  /* ================================================================ */
  const flushOfflineQueue = useCallback(async () => {
    const queued = await getQueuedMessages();
    if (queued.length === 0) return;
    console.log(`[Chat] Flushing ${queued.length} queued messages`);
    for (const q of queued) {
      try {
        await StaffChatModel.sendMessage(q.conversationId, {
          content: q.content,
          message_type: q.messageType,
          reply_to_id: q.replyToId || undefined,
          file_url: q.fileUrl || undefined,
          file_name: q.fileName || undefined,
          file_type: q.fileType || undefined,
          file_size: q.fileSize || undefined,
          thumbnail_url: q.thumbnailUrl || undefined,
        });
        await dequeueMessage(q.id!);
      } catch {
        console.warn(`[Chat] Failed to send queued message ${q.id}, will retry later`);
        break; // Stop on first failure, retry on next reconnect
      }
    }
  }, []);

  /* ================================================================ */
  /*  WebRTC service event listeners                                    */
  /* ================================================================ */
  useEffect(() => {
    const handleStateChanged = (state: CallState) => {
      setCallState(state ? { ...state } : null);
    };
    const handleRemoteStream = (data: { userId: string; stream: MediaStream }) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(data.userId, data.stream);
        return next;
      });
    };
    const handleEnded = () => {
      setCallState(null);
      setRemoteStreams(new Map());
      setIsMuted(false);
      setIsCameraOff(false);
      setIsScreenSharing(false);
    };
    const handleError = (data: { type: string; error: any }) => {
      notify.error(`Call error: ${data.type}`);
    };

    webrtcService.on('state-changed', handleStateChanged);
    webrtcService.on('remote-stream', handleRemoteStream);
    webrtcService.on('ended', handleEnded);
    webrtcService.on('error', handleError);

    return () => {
      webrtcService.off('state-changed', handleStateChanged);
      webrtcService.off('remote-stream', handleRemoteStream);
      webrtcService.off('ended', handleEnded);
      webrtcService.off('error', handleError);
    };
  }, []);

  /* ================================================================ */
  /*  Call actions                                                      */
  /* ================================================================ */
  const handleStartCall = useCallback(async (conversationId: number, callType: 'voice' | 'video') => {
    try {
      // Initiate via API (creates DB session)
      const result = await StaffChatModel.initiateCall(conversationId, callType);

      // Start WebRTC locally
      await webrtcService.startCall(result.call_id, conversationId, callType);

      // Signal via socket
      emitCallInitiate(conversationId, callType, result.call_id);
    } catch (err: any) {
      notify.error(err?.response?.data?.error || err?.message || 'Failed to start call');
    }
  }, []);

  const handleAcceptCall = useCallback(async () => {
    if (!incomingCall) return;
    stopRinging();
    try {
      // Accept via API
      await StaffChatModel.acceptCall(incomingCall.callId);

      // Start WebRTC locally
      await webrtcService.acceptCall(
        incomingCall.callId,
        incomingCall.conversationId,
        incomingCall.callType,
        incomingCall.callerId,
        incomingCall.callerName,
      );

      // Signal acceptance
      emitCallAccept(incomingCall.callId, incomingCall.conversationId);

      // Create peer connection with the caller — acceptor is initiator
      // (sends the SDP offer) so the connection works even if the other
      // side doesn't send an offer first.
      const socket = getStaffChatSocket();
      await webrtcService.createPeerConnection(incomingCall.callerId, true, socket);

      setIncomingCall(null);
    } catch (err: any) {
      notify.error(err?.message || 'Failed to accept call');
    }
  }, [incomingCall]);

  const handleDeclineCall = useCallback(() => {
    if (!incomingCall) return;
    stopRinging();
    emitCallDecline(incomingCall.callId, incomingCall.conversationId, 'declined');
    setIncomingCall(null);
  }, [incomingCall]);

  const handleEndCall = useCallback(() => {
    const cs = webrtcService.getCallState();
    if (cs) {
      emitCallEnd(cs.callId, cs.conversationId);
      webrtcService.endCall();
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    const muted = webrtcService.toggleMute();
    setIsMuted(muted);
    const cs = webrtcService.getCallState();
    if (cs) {
      emitCallParticipantUpdate(cs.callId, cs.conversationId, { muted });
    }
  }, []);

  const handleToggleCamera = useCallback(() => {
    const off = webrtcService.toggleCamera();
    setIsCameraOff(off);
    const cs = webrtcService.getCallState();
    if (cs) {
      emitCallParticipantUpdate(cs.callId, cs.conversationId, { cameraOff: off });
    }
  }, []);

  const handleToggleScreenShare = useCallback(async () => {
    const socket = getStaffChatSocket();
    const sharing = await webrtcService.toggleScreenShare(socket);
    setIsScreenSharing(sharing);
  }, []);

  const handleVoiceCall = useCallback(() => {
    if (!selected) return;
    handleStartCall(selected.id, 'voice');
  }, [selected, handleStartCall]);

  const handleVideoCall = useCallback(() => {
    if (!selected) return;
    handleStartCall(selected.id, 'video');
  }, [selected, handleStartCall]);

  const handleScheduleCall = useCallback(() => {
    if (!selected) return;
    setEditingScheduledCall(null);
    setShowScheduleCall(true);
  }, [selected]);

  const handleStartScheduledCall = useCallback(async (scheduledCallId: number) => {
    try {
      const result = await StaffChatModel.startScheduledCall(scheduledCallId);
      notify.success('Scheduled call started!');
      setShowScheduledCalls(false);
      // The backend creates a real call session — now start WebRTC
      handleStartCall(result.conversation_id, result.call_type as 'voice' | 'video');
    } catch {
      notify.error('Failed to start scheduled call');
    }
  }, [handleStartCall]);

  /* ================================================================ */
  /*  Message actions                                                   */
  /* ================================================================ */
  const handleSend = useCallback(async (text: string) => {
    if (!selected) return;
    try {
      const msg = await StaffChatModel.sendMessage(selected.id, {
        content: text,
        reply_to_id: replyTo?.id,
      });
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      setReplyTo(null);
    } catch {
      // If offline, queue the message
      const socket = getStaffChatSocket();
      if (!socket.connected) {
        await enqueueMessage({
          conversationId: selected.id,
          content: text,
          messageType: 'text',
          replyToId: replyTo?.id || null,
        });
        // Show as pending locally
        setMessages((prev) => [
          ...prev,
          {
            id: -(Date.now()),
            conversation_id: selected.id,
            sender_id: userId,
            sender_name: user?.first_name || 'You',
            sender_avatar: null,
            content: text,
            message_type: 'text',
            file_url: null,
            file_name: null,
            file_type: null,
            file_size: null,
            thumbnail_url: null,
            duration: null,
            link_preview: null,
            reply_to_id: replyTo?.id || null,
            reply_to: replyTo ? { id: replyTo.id, sender_name: replyTo.sender_name, content: replyTo.content, message_type: replyTo.message_type } : null,
            forwarded_from_id: null,
            edited_at: null,
            deleted_for_everyone_at: null,
            created_at: new Date().toISOString(),
            status: 'sent' as const,
            reactions: [],
          },
        ]);
        setReplyTo(null);
        notify.info('📤 Message queued — will send when online');
      } else {
        notify.error('Failed to send message');
      }
    }
  }, [selected, replyTo, userId, user]);

  const handleSendFile = useCallback(async (file: {
    name: string;
    type: string;
    size: number;
    base64: string;
  }) => {
    if (!selected) return;
    try {
      // Upload first
      const result = await StaffChatModel.uploadFile(selected.id, {
        file_name: file.name,
        file_type: file.type,
        file_data: file.base64,
      });
      // Then send message with file reference
      let messageType = 'file';
      if (file.type.startsWith('image/')) messageType = 'image';
      else if (file.type.startsWith('video/')) messageType = 'video';
      else if (file.type.startsWith('audio/')) messageType = 'audio';

      const msg = await StaffChatModel.sendMessage(selected.id, {
        content: '',
        message_type: messageType,
        file_url: result.file_url,
        file_name: result.file_name,
        file_type: result.file_type,
        file_size: result.file_size,
        thumbnail_url: result.thumbnail_url || undefined,
      });
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    } catch {
      notify.error('Failed to upload file');
    }
  }, [selected]);

  const handleSendGif = useCallback(async (gif: GifResult) => {
    if (!selected) return;
    try {
      const msg = await StaffChatModel.sendMessage(selected.id, {
        content: gif.title || 'GIF',
        message_type: 'gif',
        file_url: gif.url,
        thumbnail_url: gif.preview,
      });
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    } catch {
      notify.error('Failed to send GIF');
    }
  }, [selected]);

  const handleSendVoice = useCallback(async (voice: {
    name: string;
    type: string;
    size: number;
    base64: string;
    duration: number;
  }) => {
    if (!selected) return;
    try {
      // Upload voice note
      const result = await StaffChatModel.uploadFile(selected.id, {
        file_name: voice.name,
        file_type: voice.type,
        file_data: voice.base64,
      });
      // Send message with audio type
      const msg = await StaffChatModel.sendMessage(selected.id, {
        content: `🎤 Voice note (${Math.floor(voice.duration / 60)}:${String(voice.duration % 60).padStart(2, '0')})`,
        message_type: 'audio',
        file_url: result.file_url,
        file_name: result.file_name,
        file_type: result.file_type,
        file_size: result.file_size,
      });
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    } catch {
      notify.error('Failed to send voice note');
    }
  }, [selected]);

  const handleSendLocation = useCallback(async () => {
    if (!selected) return;
    if (!navigator.geolocation) {
      notify.error('Geolocation is not supported by your browser');
      return;
    }
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      const { latitude: lat, longitude: lng } = pos.coords;

      // Reverse geocode for address (best effort)
      let address = '';
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
          { headers: { 'Accept-Language': 'en' } },
        );
        const data = await resp.json();
        address = data.display_name || '';
      } catch {
        // No address — fine
      }

      const msg = await StaffChatModel.sendMessage(selected.id, {
        content: JSON.stringify({ lat, lng, address }),
        message_type: 'location',
      });
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    } catch (err: any) {
      if (err?.code === 1) {
        notify.error('Location access denied');
      } else {
        notify.error('Failed to get location');
      }
    }
  }, [selected]);

  const handleSendContact = useCallback(async () => {
    if (!selected) return;
    // Show a member selection — pick from current conversation members
    const memberChoices = members
      .filter((m) => m.user_id !== userId)
      .map((m) => ({
        value: m.user_id,
        label: m.display_name || m.email,
      }));

    if (memberChoices.length === 0) {
      notify.error('No contacts to share');
      return;
    }

    const { value: chosen } = await Swal.fire({
      title: 'Share staff contact',
      input: 'select',
      inputOptions: Object.fromEntries(memberChoices.map((c) => [c.value, c.label])),
      inputPlaceholder: 'Select a member',
      showCancelButton: true,
    });

    if (!chosen) return;

    const member = members.find((m) => m.user_id === chosen);
    if (!member) return;

    try {
      const msg = await StaffChatModel.sendMessage(selected.id, {
        content: JSON.stringify({
          userId: member.user_id,
          name: member.display_name || `${member.first_name} ${member.last_name}`,
          email: member.email,
        }),
        message_type: 'contact',
      });
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    } catch {
      notify.error('Failed to share contact');
    }
  }, [selected, members, userId]);

  const handleEdit = useCallback((msg: ChatMessage) => {
    setEditMsg(msg);
    setReplyTo(null);
  }, []);

  const handleSaveEdit = useCallback(async (text: string) => {
    if (!editMsg || !selected) return;
    try {
      await StaffChatModel.editMessage(selected.id, editMsg.id, text);
      setMessages((prev) =>
        prev.map((m) => (m.id === editMsg.id ? { ...m, content: text, edited_at: new Date().toISOString() } : m))
      );
      setEditMsg(null);
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Cannot edit message');
    }
  }, [editMsg, selected]);

  const handleDelete = useCallback(async (msg: ChatMessage) => {
    if (!selected) return;
    const result = await Swal.fire({
      title: 'Delete message?',
      text: 'This message will be deleted for everyone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await StaffChatModel.deleteMessage(selected.id, msg.id, true);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    } catch {
      notify.error('Failed to delete message');
    }
  }, [selected]);

  const handleReaction = useCallback(async (messageId: number, emoji: string) => {
    try {
      await StaffChatModel.toggleReaction(messageId, emoji);
      // Socket will broadcast the update
    } catch {
      notify.error('Failed to react');
    }
  }, []);

  const handleStar = useCallback(async (messageId: number) => {
    try {
      const result = await StaffChatModel.toggleStar(messageId);
      setStarredIds((prev) => {
        const next = new Set(prev);
        if (result.starred) next.add(messageId);
        else next.delete(messageId);
        return next;
      });
    } catch {
      notify.error('Failed to star message');
    }
  }, []);

  const handleForward = useCallback(async (msg: ChatMessage) => {
    setForwardMsg(msg);
  }, []);

  const handleTyping = useCallback(() => {
    if (selected) emitTyping(selected.id);
  }, [selected]);

  const handleReport = useCallback(async (msg: ChatMessage) => {
    const { value: reason } = await Swal.fire({
      title: 'Report message',
      text: 'Why are you reporting this message?',
      input: 'textarea',
      inputPlaceholder: 'Describe the issue...',
      showCancelButton: true,
      confirmButtonText: 'Report',
      confirmButtonColor: '#f97316',
      inputValidator: (val) => !val ? 'Please enter a reason' : null,
    });
    if (!reason) return;
    try {
      await StaffChatModel.reportMessage(msg.id, reason);
      notify.success('Message reported. An admin will review it.');
    } catch {
      notify.error('Failed to report message');
    }
  }, []);

  /* ================================================================ */
  /*  Pin / Archive / Mute                                              */
  /* ================================================================ */
  const handlePin = useCallback(async (pinned: boolean) => {
    if (!selected) return;
    try {
      await StaffChatModel.updateMembership(selected.id, { pinned });
      // Update local state
      const updater = (c: Conversation) => c.id === selected.id ? { ...c, pinned } : c;
      setConversations((prev) =>
        prev.map(updater).sort((a, b) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return new Date(b.last_message_at || b.created_at).getTime() -
            new Date(a.last_message_at || a.created_at).getTime();
        })
      );
      setSelected((prev) => prev ? { ...prev, pinned } : prev);
      notify.success(pinned ? 'Conversation pinned' : 'Conversation unpinned');
    } catch {
      notify.error('Failed to update pin');
    }
  }, [selected]);

  const handleArchive = useCallback(async (archived: boolean) => {
    if (!selected) return;
    try {
      await StaffChatModel.updateMembership(selected.id, { archived });
      setConversations((prev) => prev.map((c) => c.id === selected.id ? { ...c, archived } : c));
      setSelected((prev) => prev ? { ...prev, archived } : prev);
      if (archived) {
        // Deselect after archiving
        setSelected(null);
        setMessages([]);
      }
      notify.success(archived ? 'Conversation archived' : 'Conversation unarchived');
    } catch {
      notify.error('Failed to update archive');
    }
  }, [selected]);

  const handleMute = useCallback(async (until: string | null) => {
    if (!selected) return;
    try {
      await StaffChatModel.updateMembership(selected.id, { muted_until: until });
      setConversations((prev) =>
        prev.map((c) => c.id === selected.id ? { ...c, muted_until: until } : c)
      );
      setSelected((prev) => prev ? { ...prev, muted_until: until } : prev);
      notify.success(until ? 'Notifications muted' : 'Notifications unmuted');
    } catch {
      notify.error('Failed to update mute');
    }
  }, [selected]);

  const handleClearChat = useCallback(async () => {
    if (!selected) return;
    const result = await Swal.fire({
      title: 'Clear this chat?',
      text: 'All messages will be hidden for you. This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Clear',
    });
    if (!result.isConfirmed) return;
    try {
      await StaffChatModel.clearConversation(selected.id);
      setMessages([]);
      notify.success('Chat cleared');
    } catch {
      notify.error('Failed to clear chat');
    }
  }, [selected]);

  /* ================================================================ */
  /*  Drag-and-drop file upload                                         */
  /* ================================================================ */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selected) setDragOver(true);
  }, [selected]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!selected) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        notify.error(`${file.name} is too large (max 50MB)`);
        continue;
      }
      try {
        // Client-side image compression (if applicable)
        const processedFile = file.type.startsWith('image/') ? await compressImage(file) : file;

        // Convert to base64
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(processedFile);
        });

        const result = await StaffChatModel.uploadFile(selected.id, {
          file_name: processedFile.name,
          file_type: processedFile.type,
          file_data: base64,
        });

        // Determine message type
        let messageType = 'file';
        if (file.type.startsWith('image/')) messageType = 'image';
        else if (file.type.startsWith('video/')) messageType = 'video';
        else if (file.type.startsWith('audio/')) messageType = 'audio';

        const msg = await StaffChatModel.sendMessage(selected.id, {
          content: '',
          message_type: messageType,
          file_url: result.file_url,
          file_name: result.file_name,
          file_type: result.file_type,
          file_size: result.file_size,
        });
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      } catch {
        notify.error(`Failed to upload ${file.name}`);
      }
    }
  }, [selected]);

  /* ================================================================ */
  /*  Group management                                                  */
  /* ================================================================ */
  const handleRemoveMember = useCallback(async (memberUserId: string) => {
    if (!selected) return;
    const result = await Swal.fire({
      title: 'Remove member?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Remove',
    });
    if (!result.isConfirmed) return;
    try {
      await StaffChatModel.removeMember(selected.id, memberUserId);
      setMembers((prev) => prev.filter((m) => m.user_id !== memberUserId));
      notify.success('Member removed');
    } catch {
      notify.error('Failed to remove member');
    }
  }, [selected]);

  const handleLeaveGroup = useCallback(async () => {
    if (!selected) return;
    const result = await Swal.fire({
      title: 'Leave this group?',
      text: 'You will no longer receive messages from this group.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Leave',
    });
    if (!result.isConfirmed) return;
    try {
      await StaffChatModel.removeMember(selected.id, userId);
      setConversations((prev) => prev.filter((c) => c.id !== selected.id));
      setSelected(null);
      setMessages([]);
      setShowInfo(false);
      notify.success('Left group');
    } catch {
      notify.error('Failed to leave group');
    }
  }, [selected, userId]);

  const handleConversationCreated = useCallback((convId: number) => {
    // Reload conversations and select the new one
    StaffChatModel.getConversations().then((data: Conversation[]) => {
      setConversations(data);
      const newConv = data.find((c: Conversation) => c.id === convId);
      if (newConv) selectConversation(newConv);
    });
  }, [selectConversation]);

  const handleMembersAdded = useCallback(() => {
    if (!selected) return;
    StaffChatModel.getConversation(selected.id)
      .then((detail: any) => {
        if (detail.members) setMembers(detail.members);
      })
      .catch(() => {});
  }, [selected]);

  /* ================================================================ */
  /*  Render                                                            */
  /* ================================================================ */
  const typingUsers = selected ? typingMap.get(selected.id) || [] : [];

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50">
      {/* Sidebar */}
      <div className={`w-80 flex-shrink-0 ${mobileShowChat ? 'hidden lg:flex lg:flex-col' : 'flex flex-col w-full lg:w-80'}`}>
        {loadingConvs ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-blue-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ChatSidebar
            conversations={conversations}
            selectedId={selected?.id ?? null}
            onSelect={selectConversation}
            onNewDM={() => setShowNewDM(true)}
            onNewGroup={() => setShowNewGroup(true)}
            onShowStarred={() => setShowStarred(true)}
            onGlobalSearch={() => setShowGlobalSearch(true)}
            onCallHistory={() => setShowCallHistory(true)}
            typingMap={typingMap}
          />
        )}
      </div>

      {/* Main chat area */}
      <div
        className={`flex-1 flex flex-col min-w-0 relative ${!mobileShowChat && !selected ? 'hidden lg:flex' : 'flex'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragOver && selected && (
          <div className="absolute inset-0 z-50 bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center pointer-events-none">
            <div className="bg-white shadow-xl rounded-xl px-8 py-6 text-center">
              <div className="text-4xl mb-2">📎</div>
              <p className="text-sm font-medium text-gray-700">Drop files here to send</p>
              <p className="text-xs text-gray-400 mt-1">Max 50MB per file</p>
            </div>
          </div>
        )}

        {selected ? (
          <>
            <ChatHeader
              conversation={selected}
              onBack={() => { setMobileShowChat(false); }}
              onSearchInChat={() => setShowSearchInChat(!showSearchInChat)}
              onShowInfo={() => setShowInfo(true)}
              onPin={handlePin}
              onArchive={handleArchive}
              onMute={handleMute}
              onClearChat={handleClearChat}
              onlineUsers={onlineUsers}
              typingUsers={typingUsers}
              onVoiceCall={handleVoiceCall}
              onVideoCall={handleVideoCall}
              onScheduleCall={handleScheduleCall}
              onShowScheduledCalls={() => setShowScheduledCalls(true)}
            />
            <MessageList
              messages={messages}
              currentUserId={userId}
              onReply={(msg) => { setReplyTo(msg); setEditMsg(null); }}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReaction={handleReaction}
              onStar={handleStar}
              onForward={handleForward}
              onReport={handleReport}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              loadingMore={loadingMsgs}
              starredIds={starredIds}
              lastReadMessageId={lastReadId}
            />
            <MessageInput
              onSend={handleSend}
              onSendFile={handleSendFile}
              onSendGif={handleSendGif}
              onSendVoice={handleSendVoice}
              onSendLocation={handleSendLocation}
              onSendContact={handleSendContact}
              onTyping={handleTyping}
              replyTo={replyTo}
              editMessage={editMsg}
              onCancelReply={() => setReplyTo(null)}
              onCancelEdit={() => setEditMsg(null)}
              onSaveEdit={handleSaveEdit}
              members={members.map((m) => ({
                user_id: m.user_id,
                display_name: m.display_name,
                avatar_url: m.avatar_url,
              }))}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <ChatBubbleLeftRightIcon className="w-16 h-16 mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-1">Staff Chat</h3>
            <p className="text-sm">Select a conversation or start a new one</p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <NewDMDialog
        open={showNewDM}
        onClose={() => setShowNewDM(false)}
        onCreated={handleConversationCreated}
      />
      <NewGroupDialog
        open={showNewGroup}
        onClose={() => setShowNewGroup(false)}
        onCreated={handleConversationCreated}
      />
      {selected && (
        <>
          <AddMembersDialog
            open={showAddMembers}
            conversationId={selected.id}
            existingMemberIds={members.map((m) => m.user_id)}
            onClose={() => setShowAddMembers(false)}
            onAdded={handleMembersAdded}
          />
          <ConversationInfo
            open={showInfo}
            conversation={selected}
            members={members.map((m) => ({
              user_id: m.user_id,
              name: m.display_name || m.user_id,
              role: m.role,
              avatar_url: (m as any).avatar_url,
            }))}
            currentUserId={userId}
            onClose={() => setShowInfo(false)}
            onAddMembers={() => { setShowInfo(false); setShowAddMembers(true); }}
            onRemoveMember={handleRemoveMember}
            onLeave={handleLeaveGroup}
            onUpdateIcon={(iconUrl) => {
              if (!selected) return;
              setConversations((prev) =>
                prev.map((c) => c.id === selected.id ? { ...c, icon_url: iconUrl } : c)
              );
              setSelected((prev) => prev ? { ...prev, icon_url: iconUrl } : prev);
            }}
          />
        </>
      )}

      {/* Starred Messages Panel */}
      <StarredMessagesPanel
        open={showStarred}
        onClose={() => setShowStarred(false)}
        onNavigate={(convId, _msgId) => {
          setShowStarred(false);
          const conv = conversations.find((c) => c.id === convId);
          if (conv) selectConversation(conv);
        }}
      />

      {/* Forward Dialog */}
      <ForwardDialog
        open={forwardMsg !== null}
        message={forwardMsg}
        conversations={conversations}
        currentConversationId={selected?.id ?? null}
        onClose={() => setForwardMsg(null)}
      />

      {/* Global Search Panel */}
      <GlobalSearchPanel
        open={showGlobalSearch}
        onClose={() => setShowGlobalSearch(false)}
        onNavigate={(convId, _msgId) => {
          setShowGlobalSearch(false);
          const conv = conversations.find((c) => c.id === convId);
          if (conv) selectConversation(conv);
        }}
      />

      {/* Call History Panel */}
      <CallHistoryPanel
        open={showCallHistory}
        onClose={() => setShowCallHistory(false)}
        currentUserId={userId}
        onCall={(convId, callType) => {
          setShowCallHistory(false);
          handleStartCall(convId, callType);
        }}
      />

      {/* Schedule Call Dialog */}
      <ScheduleCallDialog
        open={showScheduleCall}
        onClose={() => { setShowScheduleCall(false); setEditingScheduledCall(null); }}
        conversationId={selected?.id ?? null}
        conversationName={
          selected
            ? (selected.type === 'direct' ? selected.dm_other_name : selected.name) || 'Conversation'
            : ''
        }
        existing={editingScheduledCall}
        onCreated={() => {
          // Force-refresh the scheduled calls panel by toggling it
          setShowScheduledCalls((prev) => {
            if (prev) {
              // Panel is open — close and reopen to trigger useEffect reload
              setTimeout(() => setShowScheduledCalls(true), 50);
              return false;
            }
            return prev;
          });
        }}
      />

      {/* Scheduled Calls Panel */}
      <ScheduledCallsPanel
        open={showScheduledCalls}
        onClose={() => setShowScheduledCalls(false)}
        currentUserId={userId}
        conversationId={selected?.id}
        onStartCall={handleStartScheduledCall}
        onEdit={(sc) => {
          setEditingScheduledCall(sc);
          setShowScheduleCall(true);
        }}
      />

      {/* Active Call Overlay */}
      {callState && callState.status !== 'ended' && (
        <CallOverlay
          callState={callState}
          localStream={webrtcService.getLocalStream()}
          remoteStreams={remoteStreams}
          onEndCall={handleEndCall}
          onToggleMute={handleToggleMute}
          onToggleCamera={handleToggleCamera}
          onToggleScreenShare={handleToggleScreenShare}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isScreenSharing={isScreenSharing}
          participantNames={
            new Map(
              Array.from(callState.participants.entries()).map(
                ([id, p]) => [id, p.displayName]
              )
            )
          }
          participantAvatars={
            new Map(
              Array.from(callState.participants.entries()).map(
                ([id, p]) => [id, p.avatarUrl]
              )
            )
          }
          callerName={
            selected
              ? (selected.type === 'direct' ? selected.dm_other_name : selected.name) || 'Call'
              : 'Call'
          }
        />
      )}

      {/* Incoming Call Modal */}
      {incomingCall && !webrtcService.isInCall() && (
        <IncomingCallModal
          callId={incomingCall.callId}
          conversationId={incomingCall.conversationId}
          callType={incomingCall.callType}
          callerName={incomingCall.callerName}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}
    </div>
  );
}
