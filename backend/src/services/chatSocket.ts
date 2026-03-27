/**
 * Chat Socket.IO — Unified `/chat` namespace
 *
 * Real-time events for the new chat system (DMs + groups):
 *   - new_message, message_edited, message_deleted
 *   - message_status  (sent → delivered → read)
 *   - user_typing / user_stop_typing
 *   - presence_update  (online / offline)
 *   - reaction_update
 *   - conversation_updated, conversation_deleted
 *
 * Runs alongside the old `/team-chats` namespace during migration.
 * Clients join rooms named `conv:<id>` for each conversation.
 */
import { Server as IOServer, Socket, Namespace } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db } from '../db/mysql.js';

let io: IOServer | null = null;
let chatNs: Namespace | null = null;

/** Get the raw Socket.IO instance */
export function getChatIO(): IOServer | null {
  return io;
}

/** Get the /chat namespace (for emitting from routes) */
export function getChatNamespace(): Namespace | null {
  return chatNs;
}

// ═══════════════════════════════════════════════════════════
// Initialisation
// ═══════════════════════════════════════════════════════════

/**
 * Initialise the `/chat` Socket.IO namespace.
 * Called once from index.ts after `app.listen()`.
 *
 * If a Socket.IO server already exists (from teamChatSocket), reuse it.
 * Otherwise create a new one.
 */
export function initChatSocket(httpServer: HTTPServer, existingIO?: IOServer): IOServer {
  io = existingIO ?? new IOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/socket.io',
  });

  chatNs = io.of('/chat');

  // ── Reset stale presence on startup ───────────────────
  // After a server restart all sockets are gone, but user_presence rows may
  // still say 'online'. Mark everyone offline so pushToOfflineMembers
  // correctly sends FCM push to disconnected mobile users.
  db.execute(
    `UPDATE user_presence SET status = 'offline', last_seen_at = NOW(), socket_ids = '[]'
     WHERE status != 'offline'`,
  ).then((affected) => {
    if (affected > 0) console.log(`[ChatSocket] Startup: reset ${affected} stale presence row(s) to offline`);
  }).catch((err) => {
    console.error('[ChatSocket] Startup: failed to reset stale presence:', err);
  });

  // ── Auth middleware — verify JWT ──────────────────────
  chatNs.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
      (socket as any).userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  chatNs.on('connection', async (socket: Socket) => {
    const userId = (socket as any).userId as string;

    // Look up the user's display name once on connection
    try {
      const userRow = await db.queryOne<{ name: string | null; email: string | null }>(
        `SELECT name, email FROM users WHERE id = ?`,
        [userId],
      );
      (socket as any).userName = userRow?.name || userRow?.email || userId;
    } catch {
      (socket as any).userName = userId;
    }

    if (env.NODE_ENV !== 'production') {
      console.log(`[ChatSocket] Connected: ${userId} (${socket.id})`);
    }

    // ── Join rooms for all conversations ──────────────
    try {
      const convs = await db.query<{ conversation_id: number }>(
        `SELECT conversation_id FROM conversation_members
         WHERE user_id = ? AND removed_at IS NULL`,
        [userId],
      );
      const joinedRooms: string[] = [];
      for (const c of convs) {
        socket.join(`conv:${c.conversation_id}`);
        joinedRooms.push(`conv:${c.conversation_id}`);
      }
      console.log(`[ChatSocket] ${userId} (${socket.id}) joined ${joinedRooms.length} rooms: ${JSON.stringify(joinedRooms)}`);
    } catch (err) {
      console.error('[ChatSocket] Failed to load conversations for', userId, err);
    }

    // ── Set presence to online ────────────────────────
    try {
      // Upsert presence row, append socket id
      const existing = await db.queryOne<{ socket_ids: string | null }>(
        'SELECT socket_ids FROM user_presence WHERE user_id = ?',
        [userId],
      );

      if (existing) {
        let ids: string[] = [];
        try {
          const parsed = existing.socket_ids ? JSON.parse(existing.socket_ids) : [];
          ids = Array.isArray(parsed) ? parsed : [];
        } catch {
          // Corrupted data — reset
          ids = [];
        }
        if (!ids.includes(socket.id)) ids.push(socket.id);
        await db.execute(
          `UPDATE user_presence SET status = 'online', socket_ids = ? WHERE user_id = ?`,
          [JSON.stringify(ids), userId],
        );
      } else {
        await db.execute(
          `INSERT INTO user_presence (user_id, status, socket_ids)
           VALUES (?, 'online', ?)`,
          [userId, JSON.stringify([socket.id])],
        );
      }

      // Broadcast presence to users who share a conversation
      broadcastPresence(userId, 'online');
    } catch (err) {
      console.error('[ChatSocket] Presence update error', err);
    }

    // ── Mark pending messages as delivered ─────────────
    try {
      const updated = await db.execute(
        `UPDATE message_status SET status = 'delivered', timestamp = NOW()
         WHERE user_id = ? AND status = 'sent'`,
        [userId],
      );
      if (updated > 0 && env.NODE_ENV !== 'production') {
        console.log(`[ChatSocket] Marked ${updated} messages as delivered for ${userId}`);
      }
    } catch (err) {
      console.error('[ChatSocket] Delivery status update error', err);
    }

    // ── Typing indicators ─────────────────────────────
    socket.on('typing', (data: { conversationId: number }) => {
      socket.to(`conv:${data.conversationId}`).emit('user_typing', {
        conversation_id: data.conversationId,
        user_id: userId,
        user_name: (socket as any).userName || userId,
      });
    });

    socket.on('stop-typing', (data: { conversationId: number }) => {
      socket.to(`conv:${data.conversationId}`).emit('user_stop_typing', {
        conversation_id: data.conversationId,
        user_id: userId,
        user_name: (socket as any).userName || userId,
      });
    });

    // ── Dynamic room management ───────────────────────
    socket.on('join-conversation', (data: { conversationId: number } | number, callback?: (err?: any) => void) => {
      try {
        const convId = typeof data === 'number' ? data : data.conversationId;
        socket.join(`conv:${convId}`);
        // Acknowledge to client
        callback?.(null);
      } catch (err) {
        callback?.(err);
      }
    });

    socket.on('leave-conversation', (data: { conversationId: number } | number, callback?: (err?: any) => void) => {
      try {
        const convId = typeof data === 'number' ? data : data.conversationId;
        socket.leave(`conv:${convId}`);
        // Acknowledge to client
        callback?.(null);
      } catch (err) {
        callback?.(err);
      }
    });

    // ═══════════════════════════════════════════════════
    // CALL SIGNALING
    // ═══════════════════════════════════════════════════

    /** 5.2.1 — Caller initiates a call */
    socket.on('call-initiate', async (data: {
      conversationId: number;
      callType: 'voice' | 'video';
      callId: number;
    }) => {
      try {
        const room = `conv:${data.conversationId}`;
        const roomSockets = chatNs?.adapter?.rooms?.get(room);
        const roomSize = roomSockets?.size ?? 0;
        const roomMembers = roomSockets ? Array.from(roomSockets) : [];
        console.log(`[ChatSocket] call-initiate received from ${userId} (${socket.id})`);
        console.log(`[ChatSocket]   room=${room}, room_size=${roomSize}`);
        console.log(`[ChatSocket]   room_members=${JSON.stringify(roomMembers)}`);
        console.log(`[ChatSocket]   caller_rooms=${JSON.stringify(Array.from(socket.rooms))}`);
        console.log(`[ChatSocket]   callId=${data.callId}, callType=${data.callType}`);

        // Notify all other members in the conversation
        socket.to(room).emit('call-ringing', {
          callId: data.callId,
          conversationId: data.conversationId,
          callType: data.callType,
          callerId: userId,
          callerName: (socket as any).userName || userId,
        });

        console.log(`[ChatSocket]   call-ringing emitted to room ${room} (excluding sender)`);
      } catch (err) {
        console.error('[ChatSocket] call-initiate error', err);
      }
    });

    /** 5.2.3 — Recipient accepts the call */
    socket.on('call-accept', async (data: {
      callId: number;
      conversationId: number;
    }) => {
      try {
        console.log(`[ChatSocket] call-accept from ${userId} (${socket.id}) callId=${data.callId} convId=${data.conversationId}`);
        // Update participant in DB
        await db.execute(
          `UPDATE call_participants SET joined_at = NOW() WHERE call_id = ? AND user_id = ?`,
          [data.callId, userId],
        );
        // Notify the room
        socket.to(`conv:${data.conversationId}`).emit('call-accepted', {
          callId: data.callId,
          conversationId: data.conversationId,
          userId,
        });
        console.log(`[ChatSocket]   call-accepted relayed to conv:${data.conversationId}`);
      } catch (err) {
        console.error('[ChatSocket] call-accept error', err);
      }
    });

    /** 5.2.4 — Recipient declines / is busy */
    socket.on('call-decline', async (data: {
      callId: number;
      conversationId: number;
      reason?: 'declined' | 'busy';
    }) => {
      try {
        await db.execute(
          `UPDATE call_participants SET left_at = NOW() WHERE call_id = ? AND user_id = ?`,
          [data.callId, userId],
        );
        socket.to(`conv:${data.conversationId}`).emit('call-declined', {
          callId: data.callId,
          conversationId: data.conversationId,
          userId,
          reason: data.reason || 'declined',
        });
        // If all participants declined, mark call as declined
        const remaining = await db.query<{ user_id: string }>(
          `SELECT user_id FROM call_participants
           WHERE call_id = ? AND joined_at IS NULL AND left_at IS NULL AND user_id != ?`,
          [data.callId, userId],
        );
        if (remaining.length === 0) {
          await db.execute(
            `UPDATE call_sessions SET status = 'declined', ended_at = NOW() WHERE id = ? AND status = 'ringing'`,
            [data.callId],
          );
        }
      } catch (err) {
        console.error('[ChatSocket] call-decline error', err);
      }
    });

    /** 5.2.5 — Any participant ends the call */
    socket.on('call-end', async (data: {
      callId: number;
      conversationId: number;
    }) => {
      try {
        // Calculate duration
        const session = await db.queryOne<{ started_at: string }>(
          `SELECT started_at FROM call_sessions WHERE id = ?`,
          [data.callId],
        );
        const durationSeconds = session
          ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
          : 0;

        await db.execute(
          `UPDATE call_sessions SET status = 'ended', ended_at = NOW(), duration_seconds = ?
           WHERE id = ? AND status IN ('ringing', 'active')`,
          [durationSeconds, data.callId],
        );
        await db.execute(
          `UPDATE call_participants SET left_at = NOW() WHERE call_id = ? AND left_at IS NULL`,
          [data.callId],
        );

        // Notify everyone in the room (including sender so they get duration)
        socket.to(`conv:${data.conversationId}`).emit('call-ended', {
          callId: data.callId,
          conversationId: data.conversationId,
          endedBy: userId,
          durationSeconds,
        });
      } catch (err) {
        console.error('[ChatSocket] call-end error', err);
      }
    });

    /** 5.2.6 — WebRTC SDP offer relay */
    socket.on('webrtc-offer', (data: {
      callId: number;
      conversationId: number;
      targetUserId: string;
      sdp: any;
    }) => {
      console.log(`[ChatSocket] webrtc-offer from ${userId} → target ${data.targetUserId} (callId=${data.callId})`);
      // Relay to conversation room, excluding sender
      socket.to(`conv:${data.conversationId}`).emit('webrtc-offer', {
        callId: data.callId,
        conversationId: data.conversationId,
        fromUserId: userId,
        targetUserId: data.targetUserId,
        sdp: data.sdp,
      });
    });

    /** 5.2.7 — WebRTC SDP answer relay */
    socket.on('webrtc-answer', (data: {
      callId: number;
      conversationId: number;
      targetUserId: string;
      sdp: any;
    }) => {
      console.log(`[ChatSocket] webrtc-answer from ${userId} → target ${data.targetUserId} (callId=${data.callId})`);
      socket.to(`conv:${data.conversationId}`).emit('webrtc-answer', {
        callId: data.callId,
        conversationId: data.conversationId,
        fromUserId: userId,
        targetUserId: data.targetUserId,
        sdp: data.sdp,
      });
    });

    /** 5.2.8 — ICE candidate relay */
    socket.on('webrtc-ice-candidate', (data: {
      callId: number;
      conversationId: number;
      targetUserId: string;
      candidate: any;
    }) => {
      console.log(`[ChatSocket] webrtc-ice-candidate from ${userId} → target ${data.targetUserId} (callId=${data.callId})`);
      socket.to(`conv:${data.conversationId}`).emit('webrtc-ice-candidate', {
        callId: data.callId,
        conversationId: data.conversationId,
        fromUserId: userId,
        targetUserId: data.targetUserId,
        candidate: data.candidate,
      });
    });

    /** 5.2.9 — Participant state update (mute/camera) */
    socket.on('call-participant-update', (data: {
      callId: number;
      conversationId: number;
      muted?: boolean;
      cameraOff?: boolean;
    }) => {
      // Persist to DB
      const updates: string[] = [];
      const vals: any[] = [];
      if (data.muted !== undefined) { updates.push('muted = ?'); vals.push(data.muted ? 1 : 0); }
      if (data.cameraOff !== undefined) { updates.push('camera_off = ?'); vals.push(data.cameraOff ? 1 : 0); }
      if (updates.length > 0) {
        db.execute(
          `UPDATE call_participants SET ${updates.join(', ')} WHERE call_id = ? AND user_id = ?`,
          [...vals, data.callId, userId],
        ).catch((err) => console.error('[ChatSocket] participant-update error', err));
      }

      // Broadcast to room
      socket.to(`conv:${data.conversationId}`).emit('call-participant-updated', {
        callId: data.callId,
        conversationId: data.conversationId,
        userId,
        muted: data.muted,
        cameraOff: data.cameraOff,
      });
    });

    // ── Disconnect → update presence ──────────────────
    socket.on('disconnect', async () => {
      if (env.NODE_ENV !== 'production') {
        console.log(`[ChatSocket] Disconnected: ${userId} (${socket.id})`);
      }

      try {
        const row = await db.queryOne<{ socket_ids: string | null }>(
          'SELECT socket_ids FROM user_presence WHERE user_id = ?',
          [userId],
        );

        if (row) {
          let ids: string[] = [];
          try {
            const parsed = row.socket_ids ? JSON.parse(row.socket_ids) : [];
            ids = Array.isArray(parsed) ? parsed : [];
          } catch {
            ids = [];
          }
          const remaining = ids.filter((id) => id !== socket.id);

          if (remaining.length === 0) {
            // No more sockets → go offline
            await db.execute(
              `UPDATE user_presence SET status = 'offline', last_seen_at = NOW(), socket_ids = '[]'
               WHERE user_id = ?`,
              [userId],
            );
            broadcastPresence(userId, 'offline');
          } else {
            // Still has other sockets open (multi-device)
            await db.execute(
              `UPDATE user_presence SET socket_ids = ? WHERE user_id = ?`,
              [JSON.stringify(remaining), userId],
            );
          }
        }
      } catch (err) {
        console.error('[ChatSocket] Disconnect presence error', err);
      }
    });
  });

  return io;
}

// ═══════════════════════════════════════════════════════════
// Broadcast helpers  (called from REST route handlers)
// ═══════════════════════════════════════════════════════════

/**
 * Broadcast new message to all members in the conversation EXCEPT the sender.
 * Uses per-socket emit to guarantee delivery and provide clear diagnostics.
 */
export function emitNewMessage(conversationId: number, message: any, senderUserId?: string): void {
  if (!chatNs) {
    console.error('[ChatSocket] emitNewMessage: chatNs is null — socket not initialised');
    return;
  }

  const payload = { ...message, conversation_id: conversationId };
  const room = `conv:${conversationId}`;

  // Get all sockets in this room
  const roomSockets = chatNs.adapter.rooms.get(room);
  if (!roomSockets || roomSockets.size === 0) {
    console.warn(`[ChatSocket] emitNewMessage: room ${room} has no sockets — nobody will receive msg ${message.id}`);
    return;
  }

  let sentCount = 0;
  let skippedSender = false;

  for (const socketId of roomSockets) {
    const sock = chatNs.sockets.get(socketId);
    if (!sock) continue;

    const sockUserId = (sock as any).userId as string | undefined;

    // Skip the sender's sockets — they already got the message from the REST response
    if (senderUserId && sockUserId === senderUserId) {
      skippedSender = true;
      continue;
    }

    sock.emit('new_message', payload);
    sentCount++;
  }

  console.log(
    `[ChatSocket] emitNewMessage: conv=${conversationId} msg=${message.id} ` +
    `room_size=${roomSockets.size} sent_to=${sentCount} sender_excluded=${skippedSender} ` +
    `sender=${senderUserId || 'none'}`
  );
}

/** Broadcast that a message was edited */
export function emitMessageEdited(
  conversationId: number,
  messageId: number,
  content: string,
  editedAt: string,
): void {
  chatNs?.to(`conv:${conversationId}`).emit('message_edited', {
    message_id: messageId,
    content,
    edited_at: editedAt,
  });
}

/** Broadcast that a message was deleted */
export function emitMessageDeleted(
  conversationId: number,
  messageId: number,
  deletedForEveryone: boolean,
): void {
  chatNs?.to(`conv:${conversationId}`).emit('message_deleted', {
    message_id: messageId,
    deleted_for_everyone: deletedForEveryone,
  });
}

/** Notify conversation members that a message status changed */
export function emitMessageStatusUpdate(
  conversationId: number,
  messageId: number,
  status: 'delivered' | 'read',
): void {
  // Emit to the conversation room so the sender's ticks update
  chatNs?.to(`conv:${conversationId}`).emit('message_status', {
    message_id: messageId,
    status,
  });
}

/** Broadcast reaction changes on a message */
export function emitReactionUpdate(
  conversationId: number,
  messageId: number,
  reactions: any[],
): void {
  chatNs?.to(`conv:${conversationId}`).emit('reaction_update', {
    message_id: messageId,
    reactions,
  });
}

/** Broadcast conversation metadata changes (name, icon, members) */
export function emitConversationUpdated(conversationId: number, changes: any): void {
  chatNs?.to(`conv:${conversationId}`).emit('conversation_updated', {
    id: conversationId,
    ...changes,
  });
}

/** Broadcast conversation deletion */
export function emitConversationDeleted(conversationId: number): void {
  chatNs?.to(`conv:${conversationId}`).emit('conversation_deleted', {
    conversation_id: conversationId,
  });
}

/** Emit incoming call ringing to a specific user's sockets */
export function emitCallRinging(conversationId: number, data: {
  callId: number;
  callType: 'voice' | 'video';
  callerId: string;
  callerName: string;
  conversationName: string | null;
}): void {
  chatNs?.to(`conv:${conversationId}`).emit('call-ringing', {
    ...data,
    conversationId,
  });
}

/** Emit call ended to the entire conversation room */
export function emitCallEnded(conversationId: number, data: {
  callId: number;
  endedBy: string;
  durationSeconds: number;
  reason?: string;
}): void {
  chatNs?.to(`conv:${conversationId}`).emit('call-ended', {
    ...data,
    conversationId,
  });
}

/** Emit call missed (after ringing timeout) */
export function emitCallMissed(conversationId: number, callId: number): void {
  chatNs?.to(`conv:${conversationId}`).emit('call-missed', {
    callId,
    conversationId,
  });
}

/** Emit scheduled call event (created/updated/cancelled/reminder) */
export function emitScheduledCall(conversationId: number, eventType: string, data: any): void {
  chatNs?.to(`conv:${conversationId}`).emit('scheduled-call', {
    type: eventType,
    conversationId,
    ...data,
  });
}

// ═══════════════════════════════════════════════════════════
// Presence helpers
// ═══════════════════════════════════════════════════════════

/**
 * Broadcast presence change to all users who share a conversation with this user.
 * Instead of blasting to everyone, we find the user's conversation rooms and emit there.
 */
async function broadcastPresence(userId: string, status: 'online' | 'offline'): Promise<void> {
  try {
    const convs = await db.query<{ conversation_id: number }>(
      `SELECT conversation_id FROM conversation_members
       WHERE user_id = ? AND removed_at IS NULL`,
      [userId],
    );

    for (const c of convs) {
      chatNs?.to(`conv:${c.conversation_id}`).emit('presence_update', {
        user_id: userId,
        status,
      });
    }
  } catch (err) {
    console.error('[ChatSocket] broadcastPresence error', err);
  }
}

/**
 * Check if a user is currently online (has at least one socket).
 * Used by REST routes to decide whether to send push notifications.
 */
export async function isUserOnline(userId: string): Promise<boolean> {
  const row = await db.queryOne<{ status: string }>(
    `SELECT status FROM user_presence WHERE user_id = ?`,
    [userId],
  );
  return row?.status === 'online';
}
