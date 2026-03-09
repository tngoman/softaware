/**
 * Team Chat Socket.IO handler
 *
 * Provides real-time events for local team chat:
 *  - team-message       → broadcast new messages to team members
 *  - team-typing        → broadcast typing indicators
 *  - team-updated       → broadcast team metadata changes
 *  - team-members-changed → broadcast membership changes
 *
 * Clients join rooms named "team:<teamId>" on connection.
 * Auth is via the JWT token in the socket handshake.
 */
import { Server as IOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db } from '../db/mysql.js';

let io: IOServer | null = null;

/** Get the shared Socket.IO server instance */
export function getIO(): IOServer | null {
  return io;
}

/**
 * Initialise Socket.IO on the given HTTP server.
 * Called once from index.ts after `app.listen()`.
 */
export function initTeamChatSocket(httpServer: HTTPServer): IOServer {
  io = new IOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    // Namespace is /team-chats
    path: '/socket.io',
  });

  const ns = io.of('/team-chats');

  // ── Auth middleware — verify JWT ──────────────────────────
  ns.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
      (socket as any).userId = decoded.userId;

      next();
    } catch (err: any) {
      next(new Error('Invalid token'));
    }
  });

  ns.on('connection', async (socket: Socket) => {
    const userId = (socket as any).userId as string;

    // Auto-join rooms for all teams the user is a member of
    try {
      const teams = await db.query<any>(
        'SELECT team_id FROM team_chat_members WHERE user_id = ? AND removed_at IS NULL',
        [userId],
      );
      for (const t of teams) {
        socket.join(`team:${t.team_id}`);
      }
    } catch (err) {
      console.error('[TeamChatSocket] Failed to load teams for user', userId, err);
    }

    // ── Typing indicator ──────────────────────────────────
    socket.on('typing', (data: { teamId: number; userName: string }) => {
      socket.to(`team:${data.teamId}`).emit('user-typing', {
        teamId: data.teamId,
        userId,
        userName: data.userName,
      });
    });

    socket.on('stop-typing', (data: { teamId: number }) => {
      socket.to(`team:${data.teamId}`).emit('user-stop-typing', {
        teamId: data.teamId,
        userId,
      });
    });

    // ── Join a specific team room (e.g. after being added) ──
    socket.on('join-team', (teamId: number) => {
      socket.join(`team:${teamId}`);
    });

    // ── Leave a team room ──
    socket.on('leave-team', (teamId: number) => {
      socket.leave(`team:${teamId}`);
    });

    socket.on('disconnect', () => {
      // Auto-cleanup by Socket.IO
    });
  });

  return io;
}

// ── Emit helpers (called from REST routes) ──────────────────

/** Broadcast a new message to all team members */
export function emitTeamMessage(teamId: number, message: any): void {
  io?.of('/team-chats').to(`team:${teamId}`).emit('team-message', {
    teamId,
    message,
  });
}

/** Broadcast that team metadata changed (name, description) */
export function emitTeamUpdated(teamId: number, team: any): void {
  io?.of('/team-chats').to(`team:${teamId}`).emit('team-updated', {
    teamId,
    team,
  });
}

/** Broadcast membership changes (added/removed members) */
export function emitTeamMembersChanged(teamId: number): void {
  io?.of('/team-chats').to(`team:${teamId}`).emit('team-members-changed', {
    teamId,
  });
}

/** Broadcast that a message was deleted */
export function emitTeamMessageDeleted(teamId: number, messageId: number): void {
  io?.of('/team-chats').to(`team:${teamId}`).emit('team-message-deleted', {
    teamId,
    messageId,
  });
}

/** Broadcast that a team was deleted */
export function emitTeamDeleted(teamId: number): void {
  io?.of('/team-chats').to(`team:${teamId}`).emit('team-deleted', {
    teamId,
  });
}
