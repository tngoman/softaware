import { Router, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from '../db/mysql.js';
import { requireAuth, AuthRequest, getAuth } from '../middleware/auth.js';
import { badRequest, notFound, forbidden } from '../utils/httpErrors.js';
import {
  emitNewMessage,
  emitMessageEdited,
  emitMessageDeleted,
  emitMessageStatusUpdate,
  emitReactionUpdate,
  emitConversationUpdated,
  emitConversationDeleted,
  emitCallRinging,
  emitCallEnded,
  emitCallMissed,
  emitScheduledCall,
  isUserOnline,
} from '../services/chatSocket.js';
import { sendPushToUser } from '../services/firebaseService.js';
import { getLinkPreviewForContent, fetchLinkPreview, extractFirstUrl } from '../services/linkPreview.js';
import { processImage, processVideo, processAudio, isImageCompressionAvailable } from '../services/mediaProcessor.js';
import axios from 'axios';
import { absoluteUrlMiddleware, resolveUrlFields } from '../utils/absoluteUrl.js';

export const staffChatRouter = Router();
staffChatRouter.use(requireAuth);

// Convert relative image/avatar paths to absolute URLs so mobile clients can load them
staffChatRouter.use(absoluteUrlMiddleware);

/* ═══════════════════════════════════════════════════════════════
   Unified Staff Chat API — DMs + Groups
   Tables: conversations, conversation_members, messages,
           message_status, message_reactions, starred_messages,
           deleted_messages, user_presence
   ═══════════════════════════════════════════════════════════════ */

// ── Zod Schemas ─────────────────────────────────────────────

const createConversationSchema = z.object({
  type: z.enum(['direct', 'group']),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  member_ids: z.array(z.string()).min(1),
});

const updateConversationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon_url: z.string().max(512).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().max(5000).optional(),
  message_type: z.enum(['text', 'image', 'video', 'audio', 'file', 'gif', 'location', 'contact', 'system']).default('text'),
  file_url: z.string().max(512).optional(),
  file_name: z.string().max(255).optional(),
  file_type: z.string().max(100).optional(),
  file_size: z.number().optional(),
  thumbnail_url: z.string().max(512).optional(),
  reply_to_id: z.number().optional(),
  forwarded_from_id: z.number().optional(),
});

const editMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

const addMembersSchema = z.object({
  user_ids: z.array(z.string()).min(1),
});

const updateMembershipSchema = z.object({
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  muted_until: z.string().nullable().optional(),
  nickname: z.string().max(100).nullable().optional(),
});

const reactionSchema = z.object({
  emoji: z.string().min(1).max(20),
});

const readReceiptSchema = z.object({
  message_id: z.number().optional(),
});

const forwardSchema = z.object({
  conversation_ids: z.array(z.number()).min(1),
});

const reportSchema = z.object({
  reason: z.string().min(1).max(1000),
});

// ── Helpers ─────────────────────────────────────────────────

async function requireMembership(conversationId: string | number, userId: string) {
  const member = await db.queryOne<any>(
    `SELECT * FROM conversation_members
     WHERE conversation_id = ? AND user_id = ? AND removed_at IS NULL`,
    [conversationId, userId],
  );
  if (!member) throw forbidden('Not a member of this conversation');
  return member;
}

/** Build the display name for a user */
function displayName(row: any): string {
  if (row.name) return row.name;
  if (row.email) return row.email;
  return row.email || 'Unknown';
}

/**
 * Serialize Date objects to ISO strings in a message object.
 * MySQL driver returns Date objects for DATETIME fields, but socket.io and REST API
 * clients expect strings. This ensures consistent serialization.
 */
function serializeMessageDates(msg: any): any {
  if (!msg) return msg;
  
  const dateFields = ['created_at', 'edited_at', 'deleted_for_everyone_at', 'last_seen_at'];
  
  for (const field of dateFields) {
    if (msg[field] instanceof Date) {
      msg[field] = msg[field].toISOString();
    }
  }
  
  // Handle reply_to nested object
  if (msg.reply_to && msg.reply_to.created_at instanceof Date) {
    msg.reply_to.created_at = msg.reply_to.created_at.toISOString();
  }
  
  return msg;
}

// ═════════════════════════════════════════════════════════════
// AVAILABLE USERS  (for DM picker — must be before /:id)
// ═════════════════════════════════════════════════════════════

staffChatRouter.get('/users/available', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);

    const users = await db.query<any>(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.avatar_url,
        COALESCE(u.name, u.email) AS display_name,
        COALESCE(p.status, 'offline') AS online_status,
        p.last_seen_at
      FROM users u
      LEFT JOIN user_presence p ON p.user_id = u.id
      WHERE u.account_status = 'active' AND u.id != ?
      ORDER BY u.name
    `, [userId]);

    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// CONVERSATIONS
// ═════════════════════════════════════════════════════════════

/**
 * GET /staff-chat/conversations — list user's conversations
 * Supports ?type=direct or ?type=group filter
 */
staffChatRouter.get('/conversations', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const typeFilter = req.query.type as string | undefined;

    let whereType = '';
    const params: any[] = [userId, userId, userId];
    if (typeFilter === 'direct' || typeFilter === 'group') {
      whereType = 'AND c.type = ?';
      params.push(typeFilter);
    }

    const conversations = await db.query<any>(`
      SELECT
        c.id,
        c.type,
        c.name,
        c.description,
        c.icon_url,
        c.created_by,
        c.created_at,
        c.updated_at,
        cm.pinned,
        cm.archived,
        cm.muted_until,
        cm.last_read_message_id,
        -- Last message
        lm.id        AS last_message_id,
        lm.content   AS last_message_content,
        lm.message_type AS last_message_type,
        lm.created_at AS last_message_at,
        lm.sender_id AS last_message_sender_id,
        COALESCE(lu.name, lu.email) AS last_message_sender_name,
        -- Unread count
        (
          SELECT COUNT(*)
          FROM messages m2
          WHERE m2.conversation_id = c.id
            AND m2.id > COALESCE(cm.last_read_message_id, 0)
            AND m2.sender_id != ?
            AND m2.deleted_for_everyone_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM deleted_messages dm WHERE dm.message_id = m2.id AND dm.user_id = ?
            )
        ) AS unread_count,
        -- Member count
        (SELECT COUNT(*) FROM conversation_members cm2 WHERE cm2.conversation_id = c.id AND cm2.removed_at IS NULL) AS member_count,
        -- For DMs: get the other member's info
        CASE WHEN c.type = 'direct' THEN (
          SELECT COALESCE(ou.name, ou.email)
          FROM conversation_members ocm
          JOIN users ou ON ou.id = ocm.user_id
          WHERE ocm.conversation_id = c.id AND ocm.user_id != ? AND ocm.removed_at IS NULL
          LIMIT 1
        ) END AS dm_other_name,
        CASE WHEN c.type = 'direct' THEN (
          SELECT ou.avatar_url
          FROM conversation_members ocm
          JOIN users ou ON ou.id = ocm.user_id
          WHERE ocm.conversation_id = c.id AND ocm.user_id != ? AND ocm.removed_at IS NULL
          LIMIT 1
        ) END AS dm_other_avatar,
        CASE WHEN c.type = 'direct' THEN (
          SELECT ocm.user_id
          FROM conversation_members ocm
          WHERE ocm.conversation_id = c.id AND ocm.user_id != ? AND ocm.removed_at IS NULL
          LIMIT 1
        ) END AS dm_other_user_id
      FROM conversations c
      INNER JOIN conversation_members cm
        ON cm.conversation_id = c.id AND cm.user_id = ? AND cm.removed_at IS NULL
      LEFT JOIN messages lm ON lm.id = (
        SELECT m.id FROM messages m
        WHERE m.conversation_id = c.id AND m.deleted_for_everyone_at IS NULL
        ORDER BY m.created_at DESC LIMIT 1
      )
      LEFT JOIN users lu ON lu.id = lm.sender_id
      WHERE 1=1 ${whereType}
      ORDER BY cm.pinned DESC, COALESCE(lm.created_at, c.created_at) DESC
    `, [...params, userId, userId, userId, userId]);

    res.json({ success: true, data: conversations });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /staff-chat/conversations — create a conversation
 * For DMs: returns existing conversation if pair exists
 */
staffChatRouter.post('/conversations', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const input = createConversationSchema.parse(req.body);

    // DM: check for existing pair
    if (input.type === 'direct') {
      if (input.member_ids.length !== 1) {
        throw badRequest('Direct messages require exactly 1 other member');
      }
      const otherId = input.member_ids[0];
      if (otherId === userId) throw badRequest('Cannot create a DM with yourself');

      // Check if DM already exists between these two
      const existing = await db.queryOne<any>(`
        SELECT c.id FROM conversations c
        WHERE c.type = 'direct'
          AND EXISTS (
            SELECT 1 FROM conversation_members cm1
            WHERE cm1.conversation_id = c.id AND cm1.user_id = ? AND cm1.removed_at IS NULL
          )
          AND EXISTS (
            SELECT 1 FROM conversation_members cm2
            WHERE cm2.conversation_id = c.id AND cm2.user_id = ? AND cm2.removed_at IS NULL
          )
      `, [userId, otherId]);

      if (existing) {
        const conv = await getConversationDetail(existing.id, userId);
        return res.json({ success: true, data: conv });
      }
    }

    // Create conversation
    const convId = await db.insert(
      `INSERT INTO conversations (type, name, description, created_by, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [input.type, input.name || null, input.description || null, userId],
    );

    // Add creator as admin
    await db.execute(
      `INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
       VALUES (?, ?, 'admin', NOW())`,
      [convId, userId],
    );

    // Add other members
    for (const memberId of input.member_ids) {
      if (memberId === userId) continue; // already added
      await db.execute(
        `INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
         VALUES (?, ?, 'member', NOW())`,
        [convId, memberId],
      );
    }

    // For groups, add a system message
    if (input.type === 'group' && input.name) {
      await db.insert(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
         VALUES (?, ?, ?, 'system', NOW())`,
        [convId, userId, `created the group "${input.name}"`],
      );
    }

    const conv = await getConversationDetail(Number(convId), userId);
    res.status(201).json({ success: true, data: conv });

    // Emit to new members so their sidebar updates
    emitConversationUpdated(Number(convId), { type: 'created', conversation: conv });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /staff-chat/conversations/:id — conversation detail with full members
 */
staffChatRouter.get('/conversations/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;

    await requireMembership(convId, userId);

    const conv = await getConversationDetail(Number(convId), userId);
    if (!conv) throw notFound('Conversation not found');

    res.json({ success: true, data: conv });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /staff-chat/conversations/:id — update name, description, icon
 */
staffChatRouter.put('/conversations/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;
    const input = updateConversationSchema.parse(req.body);

    const member = await requireMembership(convId, userId);
    const conv = await db.queryOne<any>('SELECT * FROM conversations WHERE id = ?', [convId]);
    if (!conv) throw notFound('Conversation not found');
    if (conv.type === 'group' && member.role !== 'admin') {
      throw forbidden('Only group admin can update');
    }

    const updates: string[] = [];
    const params: any[] = [];
    if (input.name !== undefined) { updates.push('name = ?'); params.push(input.name); }
    if (input.description !== undefined) { updates.push('description = ?'); params.push(input.description); }
    if (input.icon_url !== undefined) { updates.push('icon_url = ?'); params.push(input.icon_url); }

    if (updates.length === 0) throw badRequest('No fields to update');

    updates.push('updated_at = NOW()');
    params.push(convId);

    await db.execute(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await db.queryOne<any>('SELECT * FROM conversations WHERE id = ?', [convId]);
    res.json({ success: true, data: updated });

    emitConversationUpdated(Number(convId), updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /staff-chat/conversations/:id — delete group (admin only)
 */
staffChatRouter.delete('/conversations/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;

    const member = await requireMembership(convId, userId);
    const conv = await db.queryOne<any>('SELECT * FROM conversations WHERE id = ?', [convId]);
    if (!conv) throw notFound('Conversation not found');
    if (conv.type === 'direct') throw badRequest('Cannot delete a DM — archive it instead');
    if (member.role !== 'admin') throw forbidden('Only admin can delete group');

    emitConversationDeleted(Number(convId));

    // Cascade deletes handle messages, members, etc.
    await db.execute('DELETE FROM conversations WHERE id = ?', [convId]);

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /staff-chat/conversations/:id/clear — "Delete for me"
 * Sets cleared_at timestamp so messages before this time are hidden for this user.
 */
staffChatRouter.post('/conversations/:id/clear', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;

    await requireMembership(convId, userId);

    await db.execute(
      `UPDATE conversation_members SET cleared_at = NOW()
       WHERE conversation_id = ? AND user_id = ? AND removed_at IS NULL`,
      [convId, userId],
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// MEMBERS
// ═════════════════════════════════════════════════════════════

/**
 * POST /staff-chat/conversations/:id/members — add members (group admin only)
 */
staffChatRouter.post('/conversations/:id/members', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;
    const input = addMembersSchema.parse(req.body);

    const member = await requireMembership(convId, userId);
    if (member.role !== 'admin') throw forbidden('Only admin can add members');

    let added = 0;
    for (const uid of input.user_ids) {
      const existing = await db.queryOne<any>(
        `SELECT id, removed_at FROM conversation_members
         WHERE conversation_id = ? AND user_id = ?`,
        [convId, uid],
      );

      if (existing && !existing.removed_at) continue; // already active

      if (existing) {
        // Re-add previously removed member
        await db.execute(
          `UPDATE conversation_members SET removed_at = NULL, joined_at = NOW()
           WHERE conversation_id = ? AND user_id = ?`,
          [convId, uid],
        );
      } else {
        await db.execute(
          `INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
           VALUES (?, ?, 'member', NOW())`,
          [convId, uid],
        );
      }
      added++;
    }

    res.json({ success: true, data: { added } });

    emitConversationUpdated(Number(convId), { type: 'members_added', count: added });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /staff-chat/conversations/:id/members/:userId — remove or leave
 */
staffChatRouter.delete('/conversations/:id/members/:userId', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;
    const targetId = req.params.userId;

    const myMember = await requireMembership(convId, userId);

    if (targetId !== userId && myMember.role !== 'admin') {
      throw forbidden('Only admin can remove members');
    }

    await db.execute(
      `UPDATE conversation_members SET removed_at = NOW()
       WHERE conversation_id = ? AND user_id = ? AND removed_at IS NULL`,
      [convId, targetId],
    );

    res.json({ success: true });

    emitConversationUpdated(Number(convId), { type: 'member_removed', userId: targetId });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /staff-chat/conversations/:id/members/me — update own membership prefs
 */
staffChatRouter.patch('/conversations/:id/members/me', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;
    const input = updateMembershipSchema.parse(req.body);

    await requireMembership(convId, userId);

    const updates: string[] = [];
    const params: any[] = [];

    if (input.pinned !== undefined) { updates.push('pinned = ?'); params.push(input.pinned ? 1 : 0); }
    if (input.archived !== undefined) { updates.push('archived = ?'); params.push(input.archived ? 1 : 0); }
    if (input.muted_until !== undefined) { updates.push('muted_until = ?'); params.push(input.muted_until); }
    if (input.nickname !== undefined) { updates.push('nickname = ?'); params.push(input.nickname); }

    if (updates.length === 0) throw badRequest('No fields to update');
    params.push(convId, userId);

    await db.execute(
      `UPDATE conversation_members SET ${updates.join(', ')}
       WHERE conversation_id = ? AND user_id = ? AND removed_at IS NULL`,
      params,
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// MESSAGES
// ═════════════════════════════════════════════════════════════

/**
 * GET /staff-chat/conversations/:id/messages — paginated (cursor-based)
 * ?before=<messageId>&limit=50
 */
staffChatRouter.get('/conversations/:id/messages', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;
    const before = req.query.before ? Number(req.query.before) : null;
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    await requireMembership(convId, userId);

    let cursorWhere = '';
    const params: any[] = [convId, userId, convId, userId];

    if (before) {
      cursorWhere = 'AND m.id < ?';
      params.push(before);
    }

    params.push(limit);

    const messages = await db.query<any>(`
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        COALESCE(u.name, u.email) AS sender_name,
        u.avatar_url AS sender_avatar,
        m.content,
        m.message_type,
        m.file_url,
        m.file_name,
        m.file_type,
        m.file_size,
        m.thumbnail_url,
        m.link_preview_json,
        m.reply_to_id,
        m.forwarded_from_id,
        m.edited_at,
        m.deleted_for_everyone_at,
        m.created_at,
        -- Reply preview
        rm.content AS reply_content,
        rm.message_type AS reply_message_type,
        COALESCE(ru.name, ru.email) AS reply_sender_name,
        -- Aggregated status (minimum across all recipients = worst status)
        (
          SELECT MIN(CASE ms.status
            WHEN 'read' THEN 3
            WHEN 'delivered' THEN 2
            WHEN 'sent' THEN 1
            ELSE 0
          END) FROM message_status ms WHERE ms.message_id = m.id AND ms.user_id != m.sender_id
        ) AS status_code
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      LEFT JOIN messages rm ON rm.id = m.reply_to_id
      LEFT JOIN users ru ON ru.id = rm.sender_id
      WHERE m.conversation_id = ?
        AND m.deleted_for_everyone_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM deleted_messages dm WHERE dm.message_id = m.id AND dm.user_id = ?
        )
        AND m.created_at > COALESCE(
          (SELECT cm2.cleared_at FROM conversation_members cm2
           WHERE cm2.conversation_id = ? AND cm2.user_id = ? AND cm2.removed_at IS NULL),
          '1970-01-01'
        )
        ${cursorWhere}
      ORDER BY m.created_at DESC
      LIMIT ?
    `, params);

    // Fetch reactions for all returned messages
    if (messages.length > 0) {
      const msgIds = messages.map((m: any) => m.id);
      const reactions = await db.query<any>(`
        SELECT
          mr.message_id,
          mr.emoji,
          mr.user_id,
          COALESCE(u.name, u.email) AS display_name
        FROM message_reactions mr
        LEFT JOIN users u ON u.id = mr.user_id
        WHERE mr.message_id IN (${msgIds.map(() => '?').join(',')})
        ORDER BY mr.created_at ASC
      `, msgIds);

      // Group reactions by message and emoji
      const reactionsMap = new Map<number, any[]>();
      for (const r of reactions) {
        if (!reactionsMap.has(r.message_id)) reactionsMap.set(r.message_id, []);
        reactionsMap.get(r.message_id)!.push(r);
      }

      for (const msg of messages) {
        const msgReactions = reactionsMap.get(msg.id) || [];
        const grouped = new Map<string, { emoji: string; count: number; users: any[]; reacted_by_me: boolean }>();

        for (const r of msgReactions) {
          if (!grouped.has(r.emoji)) {
            grouped.set(r.emoji, { emoji: r.emoji, count: 0, users: [], reacted_by_me: false });
          }
          const g = grouped.get(r.emoji)!;
          g.count++;
          g.users.push({ user_id: r.user_id, display_name: r.display_name });
          if (r.user_id === userId) g.reacted_by_me = true;
        }

        msg.reactions = Array.from(grouped.values());

        // Map status code to string
        msg.status = msg.status_code === 3 ? 'read'
          : msg.status_code === 2 ? 'delivered'
          : 'sent';
        delete msg.status_code;

        // Build reply preview object
        if (msg.reply_to_id && msg.reply_content !== null) {
          msg.reply_to = {
            id: msg.reply_to_id,
            sender_name: msg.reply_sender_name,
            content: msg.reply_content,
            message_type: msg.reply_message_type,
          };
        } else {
          msg.reply_to = null;
        }
        delete msg.reply_content;
        delete msg.reply_message_type;
        delete msg.reply_sender_name;

        // Parse link preview JSON
        if (msg.link_preview_json && typeof msg.link_preview_json === 'string') {
          try { msg.link_preview = JSON.parse(msg.link_preview_json); } catch { msg.link_preview = null; }
        } else {
          msg.link_preview = msg.link_preview_json || null;
        }
        delete msg.link_preview_json;
      }
    }

    // Return in chronological order (query was DESC for cursor)
    messages.reverse();

    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /staff-chat/conversations/:id/messages — send a message
 */
staffChatRouter.post('/conversations/:id/messages', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;
    const input = sendMessageSchema.parse(req.body);

    if (!input.content && !input.file_url) {
      throw badRequest('Message must have content or a file');
    }

    await requireMembership(convId, userId);

    // Insert message
    const msgId = await db.insert(
      `INSERT INTO messages
         (conversation_id, sender_id, content, message_type,
          file_url, file_name, file_type, file_size, thumbnail_url,
          reply_to_id, forwarded_from_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        convId, userId,
        input.content || null,
        input.message_type,
        input.file_url || null,
        input.file_name || null,
        input.file_type || null,
        input.file_size || null,
        input.thumbnail_url || null,
        input.reply_to_id || null,
        input.forwarded_from_id || null,
      ],
    );

    // Create message_status rows for all other members (status = 'sent')
    const members = await db.query<{ user_id: string }>(
      `SELECT user_id FROM conversation_members
       WHERE conversation_id = ? AND user_id != ? AND removed_at IS NULL`,
      [convId, userId],
    );

    for (const m of members) {
      await db.execute(
        `INSERT INTO message_status (message_id, user_id, status, timestamp)
         VALUES (?, ?, 'sent', NOW())`,
        [msgId, m.user_id],
      );
    }

    // Fetch the full message to return + broadcast
    const message = await db.queryOne<any>(`
      SELECT
        m.*,
        COALESCE(u.name, u.email) AS sender_name,
        u.avatar_url AS sender_avatar
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?
    `, [msgId]);

    if (message) {
      // Serialize date fields to ISO strings
      serializeMessageDates(message);
      
      message.reactions = [];
      message.status = 'sent';
      message.reply_to = null;

      // Fetch reply preview if needed
      if (message.reply_to_id) {
        const reply = await db.queryOne<any>(`
          SELECT m.id, m.content, m.message_type, m.file_name,
                 COALESCE(u.name, u.email) AS sender_name
          FROM messages m LEFT JOIN users u ON u.id = m.sender_id
          WHERE m.id = ?
        `, [message.reply_to_id]);
        message.reply_to = reply || null;
      }

      // Parse link preview
      if (message.link_preview_json) {
        try { message.link_preview = JSON.parse(message.link_preview_json); } catch { message.link_preview = null; }
      }
      delete message.link_preview_json;
    }

    // Resolve relative paths to absolute URLs for mobile clients
    const resolved = resolveUrlFields(req, message) as any;

    res.status(201).json({ success: true, data: resolved });

    // Emit to conversation room (exclude sender — they already have it from the API response)
    emitNewMessage(Number(convId), resolved, userId);

    // Push notifications to offline members
    pushToOfflineMembers(members.map((m) => m.user_id), convId, message, userId);

    // Generate link preview asynchronously (fire-and-forget)
    if (input.message_type === 'text' && input.content) {
      generateLinkPreview(Number(msgId), Number(convId), input.content).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /staff-chat/conversations/:id/messages/:msgId — edit message
 * Sender only, within 15 minutes
 */
staffChatRouter.put('/conversations/:id/messages/:msgId', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;
    const msgId = req.params.msgId;
    const input = editMessageSchema.parse(req.body);

    await requireMembership(convId, userId);

    const msg = await db.queryOne<any>(
      'SELECT * FROM messages WHERE id = ? AND conversation_id = ?',
      [msgId, convId],
    );
    if (!msg) throw notFound('Message not found');
    if (msg.sender_id !== userId) throw forbidden('Can only edit your own messages');

    // 15-minute window
    const ageMs = Date.now() - new Date(msg.created_at).getTime();
    if (ageMs > 15 * 60 * 1000) throw badRequest('Can only edit messages within 15 minutes');

    await db.execute(
      'UPDATE messages SET content = ?, edited_at = NOW() WHERE id = ?',
      [input.content, msgId],
    );

    const updated = await db.queryOne<any>('SELECT * FROM messages WHERE id = ?', [msgId]);
    
    // Serialize date fields to ISO strings
    serializeMessageDates(updated);
    
    res.json({ success: true, data: updated });

    emitMessageEdited(Number(convId), Number(msgId), input.content, updated?.edited_at);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /staff-chat/conversations/:id/messages/:msgId
 * ?for=me|everyone
 * Delete for everyone: sender only, within 5 minutes
 */
staffChatRouter.delete('/conversations/:id/messages/:msgId', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;
    const msgId = req.params.msgId;
    const deleteFor = (req.query.for as string) || 'me';

    await requireMembership(convId, userId);

    const msg = await db.queryOne<any>(
      'SELECT * FROM messages WHERE id = ? AND conversation_id = ?',
      [msgId, convId],
    );
    if (!msg) throw notFound('Message not found');

    if (deleteFor === 'everyone') {
      if (msg.sender_id !== userId) throw forbidden('Can only delete your own messages for everyone');
      const ageMs = Date.now() - new Date(msg.created_at).getTime();
      if (ageMs > 5 * 60 * 1000) throw badRequest('Can only delete for everyone within 5 minutes');

      await db.execute(
        'UPDATE messages SET deleted_for_everyone_at = NOW() WHERE id = ?',
        [msgId],
      );

      emitMessageDeleted(Number(convId), Number(msgId), true);
    } else {
      // Delete for me — insert into deleted_messages
      await db.execute(
        `INSERT IGNORE INTO deleted_messages (user_id, message_id, deleted_at)
         VALUES (?, ?, NOW())`,
        [userId, msgId],
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /staff-chat/messages/:msgId/forward — forward to multiple conversations
 */
staffChatRouter.post('/messages/:msgId/forward', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const msgId = req.params.msgId;
    const input = forwardSchema.parse(req.body);

    const original = await db.queryOne<any>('SELECT * FROM messages WHERE id = ?', [msgId]);
    if (!original) throw notFound('Message not found');

    // Verify sender is member of the original conversation
    await requireMembership(original.conversation_id, userId);

    for (const targetConvId of input.conversation_ids) {
      await requireMembership(targetConvId, userId);

      const newMsgId = await db.insert(
        `INSERT INTO messages
           (conversation_id, sender_id, content, message_type,
            file_url, file_name, file_type, file_size, thumbnail_url,
            forwarded_from_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          targetConvId, userId,
          original.content, original.message_type,
          original.file_url, original.file_name,
          original.file_type, original.file_size,
          original.thumbnail_url, msgId,
        ],
      );

      // Create status rows for members
      const members = await db.query<{ user_id: string }>(
        `SELECT user_id FROM conversation_members
         WHERE conversation_id = ? AND user_id != ? AND removed_at IS NULL`,
        [targetConvId, userId],
      );
      for (const m of members) {
        await db.execute(
          `INSERT INTO message_status (message_id, user_id, status, timestamp) VALUES (?, ?, 'sent', NOW())`,
          [newMsgId, m.user_id],
        );
      }

      const fwdMsg = await db.queryOne<any>(`
        SELECT m.*, COALESCE(u.name, u.email) AS sender_name,
               u.avatar_url AS sender_avatar
        FROM messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.id = ?
      `, [newMsgId]);

      if (fwdMsg) {
        // Serialize date fields to ISO strings
        serializeMessageDates(fwdMsg);
        
        fwdMsg.reactions = [];
        fwdMsg.status = 'sent';
        const resolvedFwd = resolveUrlFields(req, fwdMsg) as any;
        emitNewMessage(targetConvId, resolvedFwd, userId);
      }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// REACTIONS
// ═════════════════════════════════════════════════════════════

/**
 * POST /staff-chat/messages/:msgId/reactions — toggle reaction
 */
staffChatRouter.post('/messages/:msgId/reactions', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const msgId = req.params.msgId;
    const input = reactionSchema.parse(req.body);

    const msg = await db.queryOne<any>('SELECT conversation_id FROM messages WHERE id = ?', [msgId]);
    if (!msg) throw notFound('Message not found');

    await requireMembership(msg.conversation_id, userId);

    // Toggle: if exists → remove, else → add
    const existing = await db.queryOne<any>(
      `SELECT id FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`,
      [msgId, userId, input.emoji],
    );

    if (existing) {
      await db.execute('DELETE FROM message_reactions WHERE id = ?', [existing.id]);
    } else {
      await db.execute(
        `INSERT INTO message_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, NOW())`,
        [msgId, userId, input.emoji],
      );
    }

    // Fetch updated reactions for this message
    const reactions = await getMessageReactions(Number(msgId), userId);

    res.json({ success: true, data: reactions });

    emitReactionUpdate(msg.conversation_id, Number(msgId), reactions);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /staff-chat/messages/:msgId/reactions — list reactions
 */
staffChatRouter.get('/messages/:msgId/reactions', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const msgId = req.params.msgId;

    const msg = await db.queryOne<any>('SELECT conversation_id FROM messages WHERE id = ?', [msgId]);
    if (!msg) throw notFound('Message not found');

    await requireMembership(msg.conversation_id, userId);

    const reactions = await getMessageReactions(Number(msgId), userId);
    res.json({ success: true, data: reactions });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// STARS
// ═════════════════════════════════════════════════════════════

/**
 * POST /staff-chat/messages/:msgId/star — toggle star
 */
staffChatRouter.post('/messages/:msgId/star', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const msgId = req.params.msgId;

    const msg = await db.queryOne<any>('SELECT conversation_id FROM messages WHERE id = ?', [msgId]);
    if (!msg) throw notFound('Message not found');
    await requireMembership(msg.conversation_id, userId);

    const existing = await db.queryOne<any>(
      'SELECT 1 FROM starred_messages WHERE user_id = ? AND message_id = ?',
      [userId, msgId],
    );

    if (existing) {
      await db.execute('DELETE FROM starred_messages WHERE user_id = ? AND message_id = ?', [userId, msgId]);
      res.json({ success: true, starred: false });
    } else {
      await db.execute(
        'INSERT INTO starred_messages (user_id, message_id, created_at) VALUES (?, ?, NOW())',
        [userId, msgId],
      );
      res.json({ success: true, starred: true });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /staff-chat/starred — list all starred messages
 */
staffChatRouter.get('/starred', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);

    const starred = await db.query<any>(`
      SELECT
        m.id, m.conversation_id, m.content, m.message_type,
        m.file_url, m.file_name, m.created_at,
        COALESCE(u.name, u.email) AS sender_name,
        u.avatar_url AS sender_avatar,
        c.name AS conversation_name,
        c.type AS conversation_type,
        sm.created_at AS starred_at
      FROM starred_messages sm
      INNER JOIN messages m ON m.id = sm.message_id
      LEFT JOIN users u ON u.id = m.sender_id
      LEFT JOIN conversations c ON c.id = m.conversation_id
      WHERE sm.user_id = ? AND m.deleted_for_everyone_at IS NULL
      ORDER BY sm.created_at DESC
    `, [userId]);

    // Serialize dates in starred messages
    starred.forEach((msg: any) => {
      serializeMessageDates(msg);
      // Also serialize starred_at field
      if (msg.starred_at instanceof Date) {
        msg.starred_at = msg.starred_at.toISOString();
      }
    });

    res.json({ success: true, data: starred });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// READ RECEIPTS
// ═════════════════════════════════════════════════════════════

/**
 * POST /staff-chat/conversations/:id/read — mark messages as read
 */
staffChatRouter.post('/conversations/:id/read', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;
    const input = readReceiptSchema.parse(req.body);

    await requireMembership(convId, userId);

    // If message_id is supplied, mark up to that message; otherwise mark all unread
    if (input.message_id) {
      await db.execute(
        `UPDATE message_status ms
         INNER JOIN messages m ON m.id = ms.message_id
         SET ms.status = 'read', ms.timestamp = NOW()
         WHERE m.conversation_id = ? AND ms.user_id = ? AND m.id <= ?
           AND ms.status != 'read'`,
        [convId, userId, input.message_id],
      );

      await db.execute(
        `UPDATE conversation_members SET last_read_message_id = ?
         WHERE conversation_id = ? AND user_id = ?`,
        [input.message_id, convId, userId],
      );
    } else {
      // Mark ALL messages in this conversation as read
      await db.execute(
        `UPDATE message_status ms
         INNER JOIN messages m ON m.id = ms.message_id
         SET ms.status = 'read', ms.timestamp = NOW()
         WHERE m.conversation_id = ? AND ms.user_id = ? AND ms.status != 'read'`,
        [convId, userId],
      );

      // Set last_read to the latest message
      const latest = await db.queryOne<{ id: number }>(
        `SELECT id FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1`,
        [convId],
      );
      if (latest) {
        await db.execute(
          `UPDATE conversation_members SET last_read_message_id = ?
           WHERE conversation_id = ? AND user_id = ?`,
          [latest.id, convId, userId],
        );
      }
    }

    res.json({ success: true });

    // Notify senders that their messages were read
    const senders = await db.query<{ sender_id: string; id: number }>(
      `SELECT DISTINCT m.sender_id, m.id FROM messages m
       WHERE m.conversation_id = ? AND m.id <= ? AND m.sender_id != ?`,
      [convId, input.message_id, userId],
    );
    for (const s of senders) {
      emitMessageStatusUpdate(Number(convId), s.id, 'read');
    }
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// SEARCH
// ═════════════════════════════════════════════════════════════

/**
 * GET /staff-chat/search?q=<text>&limit=20 — global search
 */
staffChatRouter.get('/search', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const q = (req.query.q as string || '').trim();
    if (!q) throw badRequest('Search query required');

    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const results = await db.query<any>(`
      SELECT
        m.id, m.conversation_id, m.content, m.message_type, m.created_at,
        COALESCE(u.name, u.email) AS sender_name,
        c.name AS conversation_name, c.type AS conversation_type
      FROM messages m
      INNER JOIN conversation_members cm
        ON cm.conversation_id = m.conversation_id AND cm.user_id = ? AND cm.removed_at IS NULL
      LEFT JOIN users u ON u.id = m.sender_id
      LEFT JOIN conversations c ON c.id = m.conversation_id
      WHERE MATCH(m.content) AGAINST(? IN BOOLEAN MODE)
        AND m.deleted_for_everyone_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM deleted_messages dm WHERE dm.message_id = m.id AND dm.user_id = ?)
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [userId, `${q}*`, userId, limit]);

    // Serialize dates in search results
    results.forEach(serializeMessageDates);

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /staff-chat/conversations/:id/search?q=<text> — search within conversation
 */
staffChatRouter.get('/conversations/:id/search', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;
    const q = (req.query.q as string || '').trim();
    if (!q) throw badRequest('Search query required');

    await requireMembership(convId, userId);

    const results = await db.query<any>(`
      SELECT
        m.id, m.content, m.message_type, m.created_at,
        COALESCE(u.name, u.email) AS sender_name
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ?
        AND MATCH(m.content) AGAINST(? IN BOOLEAN MODE)
        AND m.deleted_for_everyone_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM deleted_messages dm WHERE dm.message_id = m.id AND dm.user_id = ?)
      ORDER BY m.created_at DESC
      LIMIT 50
    `, [convId, `${q}*`, userId]);

    // Serialize dates in search results
    results.forEach(serializeMessageDates);

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// MEDIA GALLERY
// ═════════════════════════════════════════════════════════════

/**
 * GET /staff-chat/conversations/:id/media?type=images|videos|docs|links&page=1
 */
staffChatRouter.get('/conversations/:id/media', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;
    const mediaType = req.query.type as string || 'images';
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = 30;
    const offset = (page - 1) * limit;

    await requireMembership(convId, userId);

    let typeFilter: string;
    switch (mediaType) {
      case 'images': typeFilter = "m.message_type = 'image'"; break;
      case 'videos': typeFilter = "m.message_type = 'video'"; break;
      case 'docs': typeFilter = "m.message_type = 'file'"; break;
      case 'links': typeFilter = "m.link_preview_json IS NOT NULL"; break;
      default: typeFilter = "m.message_type IN ('image','video')";
    }

    const media = await db.query<any>(`
      SELECT
        m.id, m.content, m.message_type, m.file_url, m.file_name,
        m.file_type, m.file_size, m.thumbnail_url, m.link_preview_json,
        m.created_at,
        COALESCE(u.name, u.email) AS sender_name
      FROM messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ? AND ${typeFilter}
        AND m.deleted_for_everyone_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `, [convId, limit, offset]);

    // Serialize dates in media messages
    media.forEach(serializeMessageDates);

    res.json({ success: true, data: media });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// USER PROFILE (chat context)
// ═════════════════════════════════════════════════════════════

/**
 * GET /staff-chat/users/:id/profile — view user profile in chat context
 */
staffChatRouter.get('/users/:id/profile', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const targetId = req.params.id;

    const user = await db.queryOne<any>(`
      SELECT id, name, email, avatar_url
      FROM users WHERE id = ? AND account_status = 'active'
    `, [targetId]);
    if (!user) throw notFound('User not found');

    // Shared conversations
    const shared = await db.query<any>(`
      SELECT c.id, c.type, c.name
      FROM conversations c
      INNER JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = ? AND cm1.removed_at IS NULL
      INNER JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = ? AND cm2.removed_at IS NULL
      WHERE c.type = 'group'
    `, [userId, targetId]);

    // Presence
    const presence = await db.queryOne<any>(
      'SELECT status, last_seen_at FROM user_presence WHERE user_id = ?',
      [targetId],
    );

    res.json({
      success: true,
      data: {
        user: {
          ...user,
          display_name: displayName(user),
          online_status: presence?.status || 'offline',
          last_seen_at: presence?.last_seen_at || null,
        },
        shared_conversations: shared,
        shared_conversation_count: shared.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// SYNC (for reconnect catch-up)
// ═════════════════════════════════════════════════════════════

/**
 * GET /staff-chat/sync?since=<ISO timestamp>
 * Returns delta of changes since the given timestamp
 */
staffChatRouter.get('/sync', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const since = req.query.since as string;
    if (!since) throw badRequest('since parameter required');

    // New messages
    const newMessages = await db.query<any>(`
      SELECT m.*, COALESCE(u.name, u.email) AS sender_name,
             u.avatar_url AS sender_avatar
      FROM messages m
      INNER JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
        AND cm.user_id = ? AND cm.removed_at IS NULL
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.created_at > ? AND m.deleted_for_everyone_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM deleted_messages dm WHERE dm.message_id = m.id AND dm.user_id = ?)
      ORDER BY m.created_at ASC
      LIMIT 500
    `, [userId, since, userId]);

    // Edited messages
    const editedMessages = await db.query<any>(`
      SELECT m.id, m.conversation_id, m.content, m.edited_at
      FROM messages m
      INNER JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
        AND cm.user_id = ? AND cm.removed_at IS NULL
      WHERE m.edited_at > ? AND m.deleted_for_everyone_at IS NULL
    `, [userId, since]);

    // Deleted messages (for everyone)
    const deletedIds = await db.query<{ id: number }>(
      `SELECT m.id FROM messages m
       INNER JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
         AND cm.user_id = ? AND cm.removed_at IS NULL
       WHERE m.deleted_for_everyone_at > ?`,
      [userId, since],
    );

    // Status updates
    const statusUpdates = await db.query<any>(
      `SELECT ms.message_id, ms.status, ms.timestamp
       FROM message_status ms
       INNER JOIN messages m ON m.id = ms.message_id AND m.sender_id = ?
       WHERE ms.timestamp > ?`,
      [userId, since],
    );

    // Serialize dates in all messages
    newMessages.forEach(serializeMessageDates);
    editedMessages.forEach(serializeMessageDates);
    statusUpdates.forEach(serializeMessageDates);

    res.json({
      success: true,
      data: {
        new_messages: newMessages,
        edited_messages: editedMessages,
        deleted_message_ids: deletedIds.map((d) => d.id),
        status_updates: statusUpdates,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// DO NOT DISTURB
// ═════════════════════════════════════════════════════════════

/**
 * GET /staff-chat/dnd — get current DND settings
 */
staffChatRouter.get('/dnd', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const row = await db.queryOne<{
      dnd_enabled: number;
      dnd_start: string | null;
      dnd_end: string | null;
    }>(
      `SELECT dnd_enabled, dnd_start, dnd_end FROM user_presence WHERE user_id = ?`,
      [userId],
    );
    res.json({
      data: {
        enabled: row?.dnd_enabled === 1,
        start: row?.dnd_start || null,
        end: row?.dnd_end || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /staff-chat/dnd — update DND schedule
 */
const dndSchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  end: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

staffChatRouter.put('/dnd', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const body = dndSchema.parse(req.body);

    // Ensure user_presence row exists
    const exists = await db.queryOne<any>(
      'SELECT 1 FROM user_presence WHERE user_id = ?',
      [userId],
    );
    if (!exists) {
      await db.execute(
        `INSERT INTO user_presence (user_id, status, last_seen_at, dnd_enabled, dnd_start, dnd_end)
         VALUES (?, 'online', NOW(), ?, ?, ?)`,
        [userId, body.enabled ? 1 : 0, body.start ? `${body.start}:00` : null, body.end ? `${body.end}:00` : null],
      );
    } else {
      await db.execute(
        `UPDATE user_presence SET dnd_enabled = ?, dnd_start = ?, dnd_end = ? WHERE user_id = ?`,
        [body.enabled ? 1 : 0, body.start ? `${body.start}:00` : null, body.end ? `${body.end}:00` : null, userId],
      );
    }

    res.json({ data: { enabled: body.enabled, start: body.start, end: body.end } });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// NOTIFICATION SOUND
// ═════════════════════════════════════════════════════════════

/**
 * PUT /staff-chat/conversations/:id/notification-sound — set custom sound per conversation
 */
staffChatRouter.put('/conversations/:id/notification-sound', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;
    const { sound } = req.body; // string | null

    await requireMembership(convId, userId);

    await db.execute(
      `UPDATE conversation_members SET notification_sound = ? WHERE conversation_id = ? AND user_id = ?`,
      [sound || null, convId, userId],
    );

    res.json({ data: { sound: sound || null } });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// FILE UPLOAD
// ═════════════════════════════════════════════════════════════

/**
 * POST /staff-chat/conversations/:id/upload — upload file (base64)
 */
staffChatRouter.post('/conversations/:id/upload', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const convId = req.params.id;

    await requireMembership(convId, userId);

    const { file_name, file_type, file_data } = req.body;
    if (!file_name || !file_data) throw badRequest('file_name and file_data (base64) required');

    // Strip data URI prefix if present
    const base64Data = file_data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Save to uploads/staff-chat/<conversationId>/
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'staff-chat', String(convId));
    fs.mkdirSync(uploadsDir, { recursive: true });

    const timestamp = Date.now();
    const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${timestamp}_${safeName}`;
    const filePath = path.join(uploadsDir, fileName);

    fs.writeFileSync(filePath, buffer);

    let finalFileUrl = `/uploads/staff-chat/${convId}/${fileName}`;
    let finalFileSize = buffer.length;
    let thumbnailUrl: string | null = null;
    let metadata: Record<string, any> = {};

    const mimeType = (file_type || '').toLowerCase();
    const fileBase = `${timestamp}_${safeName.replace(/\.[^.]+$/, '')}`;

    // ── Image compression + thumbnail ──
    if (mimeType.startsWith('image/') && !mimeType.includes('gif')) {
      const result = await processImage(filePath, uploadsDir, fileBase);
      if (result) {
        // Replace original with compressed version
        fs.copyFileSync(result.filePath, filePath);
        if (result.filePath !== filePath) fs.unlinkSync(result.filePath);
        finalFileSize = result.fileSize;
        thumbnailUrl = `/uploads/staff-chat/${convId}/${result.thumbnailUrl}`;
        metadata = { width: result.width, height: result.height };
      }
    }

    // ── Video thumbnail ──
    if (mimeType.startsWith('video/')) {
      const result = await processVideo(filePath, uploadsDir, fileBase);
      if (result) {
        thumbnailUrl = `/uploads/staff-chat/${convId}/${result.thumbnailName}`;
        if (result.duration) metadata.duration = result.duration;
      }
    }

    // ── Audio duration ──
    if (mimeType.startsWith('audio/')) {
      const result = await processAudio(filePath);
      if (result?.duration) metadata.duration = result.duration;
    }

    res.json({
      success: true,
      file_url: finalFileUrl,
      file_name: safeName,
      file_type: file_type || 'application/octet-stream',
      file_size: finalFileSize,
      thumbnail_url: thumbnailUrl,
      ...metadata,
    });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// AVATAR UPLOAD
// ═════════════════════════════════════════════════════════════

/**
 * POST /staff-chat/profile/avatar — upload/update avatar
 */
staffChatRouter.post('/profile/avatar', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);

    const { file_data, file_name } = req.body;
    if (!file_data) throw badRequest('file_data (base64) required');

    const base64Data = file_data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const avatarDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
    fs.mkdirSync(avatarDir, { recursive: true });

    const ext = (file_name || 'avatar.png').split('.').pop() || 'png';
    const fileName = `${userId}.${ext}`;
    const filePath = path.join(avatarDir, fileName);

    fs.writeFileSync(filePath, buffer);

    const avatarUrl = `/uploads/avatars/${fileName}?t=${Date.now()}`;

    await db.execute('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);

    res.json({ success: true, avatar_url: avatarUrl });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// REPORT MESSAGE
// ═════════════════════════════════════════════════════════════

/**
 * POST /staff-chat/messages/:msgId/report — report a message
 */
staffChatRouter.post('/messages/:msgId/report', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const msgId = req.params.msgId;
    const input = reportSchema.parse(req.body);

    const msg = await db.queryOne<any>('SELECT * FROM messages WHERE id = ?', [msgId]);
    if (!msg) throw notFound('Message not found');
    await requireMembership(msg.conversation_id, userId);

    // Create a case in the existing cases system (if table exists)
    try {
      await db.insert(
        `INSERT INTO cases (title, description, status, priority, created_by, created_at)
         VALUES (?, ?, 'open', 'medium', ?, NOW())`,
        [
          `Reported chat message #${msgId}`,
          `Reason: ${input.reason}\n\nMessage content: ${msg.content || '[media]'}\nSender: ${msg.sender_id}\nConversation: ${msg.conversation_id}`,
          userId,
        ],
      );
    } catch {
      // Cases table may not exist — just log it
      console.warn('[StaffChat] Could not create report case — cases table may not exist');
    }

    res.json({ success: true, message: 'Message reported' });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═════════════════════════════════════════════════════════════

/** Get conversation detail with members */
async function getConversationDetail(convId: number, requestingUserId: string) {
  const conv = await db.queryOne<any>('SELECT * FROM conversations WHERE id = ?', [convId]);
  if (!conv) return null;

  const members = await db.query<any>(`
    SELECT
      cm.user_id,
      cm.role,
      cm.nickname,
      cm.joined_at,
      u.name,
      u.email,
      u.avatar_url,
      COALESCE(u.name, u.email) AS display_name,
      COALESCE(p.status, 'offline') AS online_status,
      p.last_seen_at
    FROM conversation_members cm
    LEFT JOIN users u ON u.id = cm.user_id
    LEFT JOIN user_presence p ON p.user_id = cm.user_id
    WHERE cm.conversation_id = ? AND cm.removed_at IS NULL
    ORDER BY cm.joined_at ASC
  `, [convId]);

  return { ...conv, members };
}

/** Get reactions for a message, grouped by emoji */
async function getMessageReactions(msgId: number, requestingUserId: string) {
  const raw = await db.query<any>(`
    SELECT mr.emoji, mr.user_id,
           COALESCE(u.name, u.email) AS display_name
    FROM message_reactions mr
    LEFT JOIN users u ON u.id = mr.user_id
    WHERE mr.message_id = ?
    ORDER BY mr.created_at ASC
  `, [msgId]);

  const grouped = new Map<string, { emoji: string; count: number; users: any[]; reacted_by_me: boolean }>();
  for (const r of raw) {
    if (!grouped.has(r.emoji)) {
      grouped.set(r.emoji, { emoji: r.emoji, count: 0, users: [], reacted_by_me: false });
    }
    const g = grouped.get(r.emoji)!;
    g.count++;
    g.users.push({ user_id: r.user_id, display_name: r.display_name });
    if (r.user_id === requestingUserId) g.reacted_by_me = true;
  }

  return Array.from(grouped.values());
}

// ═════════════════════════════════════════════════════════════
// GIF SEARCH PROXY (Tenor v2 free tier)
// ═════════════════════════════════════════════════════════════

/**
 * GET /staff-chat/gifs?q=<search>&limit=20
 * Searches Tenor v2 for GIFs. Uses the free anonymous tier.
 */
staffChatRouter.get('/gifs', async (req: AuthRequest, res: Response, next) => {
  try {
    const query = (req.query.q as string || '').trim();
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    if (!query) {
      // Return trending
      const { data } = await axios.get('https://tenor.googleapis.com/v2/featured', {
        params: {
          key: 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ', // Tenor anonymous key
          client_key: 'softaware_chat',
          media_filter: 'gif,tinygif',
          limit,
        },
        timeout: 5000,
      });
      const gifs = (data.results || []).map((r: any) => ({
        id: r.id,
        title: r.title || '',
        url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || '',
        preview: r.media_formats?.tinygif?.url || r.media_formats?.nanogif?.url || '',
        width: r.media_formats?.gif?.dims?.[0] || 0,
        height: r.media_formats?.gif?.dims?.[1] || 0,
      }));
      return res.json({ success: true, data: gifs });
    }

    const { data } = await axios.get('https://tenor.googleapis.com/v2/search', {
      params: {
        key: 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ',
        client_key: 'softaware_chat',
        q: query,
        media_filter: 'gif,tinygif',
        limit,
      },
      timeout: 5000,
    });

    const gifs = (data.results || []).map((r: any) => ({
      id: r.id,
      title: r.title || '',
      url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || '',
      preview: r.media_formats?.tinygif?.url || r.media_formats?.nanogif?.url || '',
      width: r.media_formats?.gif?.dims?.[0] || 0,
      height: r.media_formats?.gif?.dims?.[1] || 0,
    }));

    res.json({ success: true, data: gifs });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// LINK PREVIEW ENDPOINT (on-demand)
// ═════════════════════════════════════════════════════════════

/**
 * GET /staff-chat/link-preview?url=<url>
 * Fetches Open Graph / meta tags for a URL.
 */
staffChatRouter.get('/link-preview', async (req: AuthRequest, res: Response, next) => {
  try {
    const url = req.query.url as string;
    if (!url) throw badRequest('url query parameter required');

    const preview = await fetchLinkPreview(url);
    if (!preview) {
      return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: preview });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// VOICE & VIDEO CALLING (Phase 5)
// ═════════════════════════════════════════════════════════════

/**
 * GET /staff-chat/calls/ice-config
 * Returns ICE server configuration for WebRTC peer connections.
 */
staffChatRouter.get('/calls/ice-config', async (_req: AuthRequest, res: Response, next) => {
  try {
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:softaware.net.za:3478' },
      // TURN server (coturn on this host) — required for mobile/NAT traversal
      {
        urls: [
          'turn:softaware.net.za:3478?transport=udp',
          'turn:softaware.net.za:3478?transport=tcp',
          'turns:softaware.net.za:5349?transport=tcp',
        ],
        username: 'softaware',
        credential: 'S0ftAware2026!Turn',
      },
    ];
    res.json({ success: true, data: { iceServers } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /staff-chat/calls/initiate
 * Initiates a new call. Creates the call_session and call_participants rows.
 * Returns the call_id for the caller to use in signaling.
 */
staffChatRouter.post('/calls/initiate', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    // Accept both snake_case (conversation_id, call_type) and camelCase (conversationId, callType)
    const body = req.body;
    const normalised = {
      conversation_id: body.conversation_id ?? body.conversationId,
      call_type: body.call_type ?? body.callType,
    };
    const schema = z.object({
      conversation_id: z.number(),
      call_type: z.enum(['voice', 'video']),
    });
    const parsed = schema.parse(normalised);

    // Verify membership
    await requireMembership(parsed.conversation_id, userId);

    // Check if there's already an active/ringing call in this conversation
    // First, auto-expire any stale ringing calls older than 60 seconds
    await db.execute(
      `UPDATE call_sessions SET status = 'missed', ended_at = NOW()
       WHERE conversation_id = ? AND status = 'ringing'
         AND started_at < DATE_SUB(NOW(), INTERVAL 60 SECOND)`,
      [parsed.conversation_id],
    );
    const existing = await db.queryOne<any>(
      `SELECT id FROM call_sessions
       WHERE conversation_id = ? AND status IN ('ringing', 'active')`,
      [parsed.conversation_id],
    );
    if (existing) throw badRequest('There is already an active call in this conversation');

    // Create call session
    const callId = await db.insert(
      `INSERT INTO call_sessions (conversation_id, type, initiated_by, status)
       VALUES (?, ?, ?, 'ringing')`,
      [parsed.conversation_id, parsed.call_type, userId],
    );

    // Add all members as participants
    const members = await db.query<{ user_id: string }>(
      `SELECT user_id FROM conversation_members
       WHERE conversation_id = ? AND removed_at IS NULL`,
      [parsed.conversation_id],
    );

    for (const m of members) {
      const joinedAt = m.user_id === userId ? 'NOW()' : null;
      await db.execute(
        `INSERT INTO call_participants (call_id, user_id, joined_at)
         VALUES (?, ?, ${joinedAt ? 'NOW()' : 'NULL'})`,
        [callId, m.user_id],
      );
    }

    // Get caller info
    const caller = await db.queryOne<any>(
      `SELECT name, email, avatar_url FROM users WHERE id = ?`,
      [userId],
    );
    const callerName = displayName(caller || {});

    // Get conversation name for push notifications
    const conv = await db.queryOne<any>(
      `SELECT name, type FROM conversations WHERE id = ?`,
      [parsed.conversation_id],
    );
    let convName = conv?.name || null;
    if (conv?.type === 'direct') {
      convName = callerName;
    }

    // Send push to offline members
    for (const m of members) {
      if (m.user_id === userId) continue;
      const online = await isUserOnline(m.user_id);
      if (!online) {
        sendPushToUser(m.user_id, {
          title: `Incoming ${parsed.call_type} call`,
          body: `${callerName} is calling...`,
          data: {
            type: 'incoming_call',
            callId: String(callId),
            callType: parsed.call_type,
            conversationId: String(parsed.conversation_id),
            callerId: userId,
            callerName,
            priority: 'high',
            link: `/chat?c=${parsed.conversation_id}`,
          },
        }).catch((err) => {
          console.error('[StaffChat] Call push error for', m.user_id, err);
        });
      }
    }

    // Auto-miss after 45 seconds if still ringing
    setTimeout(async () => {
      try {
        const session = await db.queryOne<{ status: string }>(
          `SELECT status FROM call_sessions WHERE id = ?`,
          [callId],
        );
        if (session?.status === 'ringing') {
          await db.execute(
            `UPDATE call_sessions SET status = 'missed', ended_at = NOW() WHERE id = ?`,
            [callId],
          );
          await db.execute(
            `UPDATE call_participants SET left_at = NOW() WHERE call_id = ? AND left_at IS NULL`,
            [callId],
          );
          emitCallMissed(parsed.conversation_id, Number(callId));
        }
      } catch (err) {
        console.error('[StaffChat] Auto-miss timeout error', err);
      }
    }, 45000);

    res.json({
      success: true,
      data: {
        call_id: Number(callId),
        conversation_id: parsed.conversation_id,
        call_type: parsed.call_type,
        status: 'ringing',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /staff-chat/calls/:id/accept
 * Marks the call as active when a participant accepts.
 */
staffChatRouter.post('/calls/:id/accept', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const callId = req.params.id;

    // Update call status to active (if still ringing), and set started_at to now
    await db.execute(
      `UPDATE call_sessions SET status = 'active', started_at = NOW() WHERE id = ? AND status = 'ringing'`,
      [callId],
    );
    // Update participant joined_at
    await db.execute(
      `UPDATE call_participants SET joined_at = NOW() WHERE call_id = ? AND user_id = ? AND joined_at IS NULL`,
      [callId, userId],
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /staff-chat/calls/history
 * Returns call history for the authenticated user.
 */
staffChatRouter.get('/calls/history', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const calls = await db.query<any>(
      `SELECT
        cs.id,
        cs.conversation_id,
        cs.type AS call_type,
        cs.initiated_by,
        cs.status,
        cs.started_at,
        cs.ended_at,
        cs.duration_seconds,
        c.name AS conversation_name,
        c.type AS conversation_type,
        u.name AS caller_name,
        u.avatar_url AS caller_avatar,
        cp.joined_at AS my_joined_at,
        (SELECT COUNT(*) FROM call_participants WHERE call_id = cs.id AND joined_at IS NOT NULL) AS participant_count
       FROM call_sessions cs
       JOIN call_participants cp ON cp.call_id = cs.id AND cp.user_id = ?
       JOIN conversations c ON c.id = cs.conversation_id
       LEFT JOIN users u ON u.id = cs.initiated_by
       ORDER BY cs.started_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset],
    );

    // For DM calls, add the other user's info
    for (const call of calls) {
      if (call.conversation_type === 'direct') {
        const other = await db.queryOne<any>(
          `SELECT u.id, u.name, u.avatar_url
           FROM conversation_members cm
           JOIN users u ON u.id = cm.user_id
           WHERE cm.conversation_id = ? AND cm.user_id != ? AND cm.removed_at IS NULL
           LIMIT 1`,
          [call.conversation_id, userId],
        );
        if (other) {
          call.other_user_name = other.name || other.email || 'Unknown';
          call.other_user_avatar = other.avatar_url;
          call.other_user_id = other.id;
        }
      }
    }

    res.json({ success: true, data: calls });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /staff-chat/calls/:id
 * Returns call detail with participants.
 */
staffChatRouter.get('/calls/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const callId = req.params.id;

    const call = await db.queryOne<any>(
      `SELECT
        cs.*,
        c.name AS conversation_name,
        c.type AS conversation_type,
        u.name AS caller_name,
        u.avatar_url AS caller_avatar
       FROM call_sessions cs
       JOIN conversations c ON c.id = cs.conversation_id
       LEFT JOIN users u ON u.id = cs.initiated_by
       WHERE cs.id = ?`,
      [callId],
    );
    if (!call) throw notFound('Call not found');

    // Verify user was a participant
    const participant = await db.queryOne<any>(
      `SELECT * FROM call_participants WHERE call_id = ? AND user_id = ?`,
      [callId, userId],
    );
    if (!participant) throw forbidden('Not a participant of this call');

    // Get all participants
    const participants = await db.query<any>(
      `SELECT
        cp.*,
        u.name AS display_name,
        u.avatar_url
       FROM call_participants cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.call_id = ?`,
      [callId],
    );

    res.json({ success: true, data: { ...call, participants } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /staff-chat/calls/:id/end
 * Force-end a call (admin or any participant).
 */
staffChatRouter.post('/calls/:id/end', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const callId = req.params.id;

    const session = await db.queryOne<any>(
      `SELECT * FROM call_sessions WHERE id = ?`,
      [callId],
    );
    if (!session) throw notFound('Call not found');
    if (session.status === 'ended') throw badRequest('Call already ended');

    const durationSeconds = Math.floor(
      (Date.now() - new Date(session.started_at).getTime()) / 1000,
    );

    await db.execute(
      `UPDATE call_sessions SET status = 'ended', ended_at = NOW(), duration_seconds = ?
       WHERE id = ?`,
      [durationSeconds, callId],
    );
    await db.execute(
      `UPDATE call_participants SET left_at = NOW() WHERE call_id = ? AND left_at IS NULL`,
      [callId],
    );

    emitCallEnded(session.conversation_id, {
      callId: Number(callId),
      endedBy: userId,
      durationSeconds,
      reason: 'force-ended',
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// SCHEDULED CALLS
// ═════════════════════════════════════════════════════════════

/**
 * POST /staff-chat/scheduled-calls
 * Schedule a new call in a conversation.
 */
staffChatRouter.post('/scheduled-calls', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const parsed = z.object({
      conversation_id: z.number().int().positive(),
      title: z.string().min(1).max(255),
      description: z.string().max(1000).optional(),
      call_type: z.enum(['voice', 'video']).default('video'),
      screen_share: z.boolean().default(false),
      scheduled_at: z.string().min(1),
      duration_minutes: z.number().int().min(5).max(480).default(30),
      recurrence: z.enum(['none', 'daily', 'weekly', 'biweekly', 'monthly']).default('none'),
      recurrence_end: z.string().optional(),
      participant_ids: z.array(z.string()).optional(),
    }).parse(req.body);

    // Verify user is a member of the conversation
    const membership = await db.queryOne<any>(
      `SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND removed_at IS NULL`,
      [parsed.conversation_id, userId],
    );
    if (!membership) throw forbidden('Not a member of this conversation');

    // Resolve participant list before transaction
    let participantIds: string[] = [];
    if (parsed.participant_ids && parsed.participant_ids.length > 0) {
      participantIds = [...parsed.participant_ids];
      if (!participantIds.includes(userId)) participantIds.push(userId);
    } else {
      const members = await db.query<{ user_id: string }>(
        `SELECT user_id FROM conversation_members WHERE conversation_id = ? AND removed_at IS NULL`,
        [parsed.conversation_id],
      );
      participantIds = members.map(m => m.user_id);
    }

    // Run create + participants + system message in a transaction
    // Convert ISO 8601 datetime to MySQL-compatible format
    const scheduledAtMysql = parsed.scheduled_at.replace('T', ' ').replace('Z', '');
    const recurrenceEndMysql = parsed.recurrence_end ? parsed.recurrence_end.replace('T', ' ').replace('Z', '') : null;

    const { scId, result } = await db.transaction(async (conn) => {
      // Create scheduled call
      const [insertResult] = await conn.query(
        `INSERT INTO scheduled_calls
          (conversation_id, created_by, title, description, call_type, screen_share,
           scheduled_at, duration_minutes, recurrence, recurrence_end, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
        [
          parsed.conversation_id,
          userId,
          parsed.title,
          parsed.description || null,
          parsed.call_type,
          parsed.screen_share ? 1 : 0,
          scheduledAtMysql,
          parsed.duration_minutes,
          parsed.recurrence,
          recurrenceEndMysql,
        ],
      );
      const scId = String((insertResult as any).insertId);

      // Batch insert participants
      if (participantIds.length > 0) {
        const placeholders = participantIds.map(() => '(?, ?, ?)').join(', ');
        const values = participantIds.flatMap(pid => [scId, pid, pid === userId ? 'accepted' : 'pending']);
        await conn.query(
          `INSERT INTO scheduled_call_participants (scheduled_call_id, user_id, rsvp) VALUES ${placeholders}`,
          values,
        );
      }

      // System message inside the same transaction
      const creatorRow = await conn.query(`SELECT name, email FROM users WHERE id = ?`, [userId]);
      const creator = (creatorRow as any)[0]?.[0];
      const creatorName = creator?.name || creator?.email || 'Someone';
      const schedDate = new Date(parsed.scheduled_at);
      const timeStr = schedDate.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });

      await conn.query(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
         VALUES (?, ?, ?, 'system', NOW())`,
        [
          parsed.conversation_id,
          userId,
          `📅 ${creatorName} scheduled a ${parsed.call_type} call: "${parsed.title}" for ${timeStr}${parsed.screen_share ? ' (screen sharing enabled)' : ''}`,
        ],
      );

      // Fetch the complete record within transaction
      const [scheduledRows] = await conn.query(
        `SELECT sc.*, u.name AS creator_name, u.email AS creator_email
         FROM scheduled_calls sc
         LEFT JOIN users u ON u.id = sc.created_by
         WHERE sc.id = ?`,
        [scId],
      );
      const scheduled = (scheduledRows as any[])[0];

      const [participantRows] = await conn.query(
        `SELECT scp.user_id, scp.rsvp, scp.created_at,
                u.name, u.email, u.avatar_url
         FROM scheduled_call_participants scp
         LEFT JOIN users u ON u.id = scp.user_id
         WHERE scp.scheduled_call_id = ?`,
        [scId],
      );

      return { scId, result: { ...scheduled, participants: participantRows as any[] } };
    });

    const scheduled = result;

    // Notify via socket
    emitScheduledCall(parsed.conversation_id, 'created', result);

    // Emit system message to socket (already inserted in transaction)
    const creatorName = scheduled?.creator_name || scheduled?.creator_email || 'Someone';
    const schedDate = new Date(parsed.scheduled_at);
    const timeStr = schedDate.toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });

    // Send push notification to offline participants (fire-and-forget)
    for (const pid of participantIds) {
      if (pid === userId) continue;
      try {
        const online = await isUserOnline(pid);
        if (online) continue;
        await sendPushToUser(pid, {
          title: `📅 ${parsed.call_type === 'video' ? 'Video' : 'Voice'} call scheduled`,
          body: `${creatorName} scheduled "${parsed.title}" for ${timeStr}${parsed.screen_share ? ' (with screen sharing)' : ''}`,
          data: {
            type: 'scheduled_call',
            conversationId: String(parsed.conversation_id),
            scheduledCallId: String(scId),
            link: `/chat?c=${parsed.conversation_id}`,
          },
        });
      } catch { /* don't fail the create if push fails */ }
    }

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /staff-chat/scheduled-calls
 * List all upcoming scheduled calls for the current user.
 */
staffChatRouter.get('/scheduled-calls', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const status = (req.query.status as string) || 'upcoming';
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const conversationId = req.query.conversation_id ? Number(req.query.conversation_id) : null;

    // Build status filter
    let statusClause: string;
    let statusParams: any[];
    if (status === 'upcoming') {
      statusClause = `sc.status IN ('scheduled', 'active')`;
      statusParams = [];
    } else if (status === 'all') {
      statusClause = `1=1`;
      statusParams = [];
    } else {
      statusClause = `sc.status = ?`;
      statusParams = [status];
    }

    // Optional conversation filter
    const convClause = conversationId ? `AND sc.conversation_id = ?` : '';
    const convParams = conversationId ? [conversationId] : [];

    const calls = await db.query<any>(
      `SELECT
        sc.*,
        u.name AS creator_name, u.email AS creator_email, u.avatar_url AS creator_avatar,
        c.name AS conversation_name, c.type AS conversation_type,
        scp.rsvp AS my_rsvp,
        (SELECT COUNT(*) FROM scheduled_call_participants WHERE scheduled_call_id = sc.id) AS participant_count,
        (SELECT COUNT(*) FROM scheduled_call_participants WHERE scheduled_call_id = sc.id AND rsvp = 'accepted') AS accepted_count
       FROM scheduled_calls sc
       JOIN scheduled_call_participants scp ON scp.scheduled_call_id = sc.id AND scp.user_id = ?
       JOIN conversations c ON c.id = sc.conversation_id
       LEFT JOIN users u ON u.id = sc.created_by
       WHERE ${statusClause} ${convClause}
       ORDER BY sc.scheduled_at ASC
       LIMIT ? OFFSET ?`,
      [userId, ...statusParams, ...convParams, limit, offset],
    );

    // Enrich DM calls with other-user info (same pattern as call history)
    for (const call of calls) {
      if (call.conversation_type === 'direct') {
        const other = await db.queryOne<any>(
          `SELECT u.id, u.name, u.email, u.avatar_url
           FROM conversation_members cm
           JOIN users u ON u.id = cm.user_id
           WHERE cm.conversation_id = ? AND cm.user_id != ? AND cm.removed_at IS NULL
           LIMIT 1`,
          [call.conversation_id, userId],
        );
        if (other) {
          call.other_user_name = other.name || other.email;
          call.other_user_avatar = other.avatar_url;
          call.other_user_id = other.id;
        }
      }
    }

    res.json({ success: true, data: calls });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /staff-chat/scheduled-calls/:id
 * Get scheduled call detail with participants.
 */
staffChatRouter.get('/scheduled-calls/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const scId = req.params.id;

    const call = await db.queryOne<any>(
      `SELECT sc.*, u.name AS creator_name, u.email AS creator_email, u.avatar_url AS creator_avatar,
              c.name AS conversation_name, c.type AS conversation_type
       FROM scheduled_calls sc
       JOIN conversations c ON c.id = sc.conversation_id
       LEFT JOIN users u ON u.id = sc.created_by
       WHERE sc.id = ?`,
      [scId],
    );
    if (!call) throw notFound('Scheduled call not found');

    // Verify user is a participant
    const myParticipant = await db.queryOne<any>(
      `SELECT * FROM scheduled_call_participants WHERE scheduled_call_id = ? AND user_id = ?`,
      [scId, userId],
    );
    if (!myParticipant) throw forbidden('Not a participant of this scheduled call');

    const participants = await db.query<any>(
      `SELECT scp.user_id, scp.rsvp, scp.created_at,
              u.name, u.email, u.avatar_url
       FROM scheduled_call_participants scp
       LEFT JOIN users u ON u.id = scp.user_id
       WHERE scp.scheduled_call_id = ?`,
      [scId],
    );

    res.json({ success: true, data: { ...call, participants, my_rsvp: myParticipant.rsvp } });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /staff-chat/scheduled-calls/:id
 * Update a scheduled call (creator only).
 */
staffChatRouter.put('/scheduled-calls/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const scId = req.params.id;

    const call = await db.queryOne<any>(`SELECT * FROM scheduled_calls WHERE id = ?`, [scId]);
    if (!call) throw notFound('Scheduled call not found');
    if (call.created_by !== userId) throw forbidden('Only the creator can update this call');
    if (call.status !== 'scheduled') throw badRequest('Cannot update a call that is not scheduled');

    const parsed = z.object({
      title: z.string().min(1).max(255).optional(),
      description: z.string().max(1000).optional(),
      call_type: z.enum(['voice', 'video']).optional(),
      screen_share: z.boolean().optional(),
      scheduled_at: z.string().optional(),
      duration_minutes: z.number().int().min(5).max(480).optional(),
      recurrence: z.enum(['none', 'daily', 'weekly', 'biweekly', 'monthly']).optional(),
      recurrence_end: z.string().nullable().optional(),
    }).parse(req.body);

    const sets: string[] = [];
    const vals: any[] = [];
    if (parsed.title !== undefined) { sets.push('title = ?'); vals.push(parsed.title); }
    if (parsed.description !== undefined) { sets.push('description = ?'); vals.push(parsed.description); }
    if (parsed.call_type !== undefined) { sets.push('call_type = ?'); vals.push(parsed.call_type); }
    if (parsed.screen_share !== undefined) { sets.push('screen_share = ?'); vals.push(parsed.screen_share ? 1 : 0); }
    if (parsed.scheduled_at !== undefined) { sets.push('scheduled_at = ?'); vals.push(parsed.scheduled_at.replace('T', ' ').replace('Z', '')); }
    if (parsed.duration_minutes !== undefined) { sets.push('duration_minutes = ?'); vals.push(parsed.duration_minutes); }
    if (parsed.recurrence !== undefined) { sets.push('recurrence = ?'); vals.push(parsed.recurrence); }
    if (parsed.recurrence_end !== undefined) { sets.push('recurrence_end = ?'); vals.push(parsed.recurrence_end ? parsed.recurrence_end.replace('T', ' ').replace('Z', '') : null); }

    if (sets.length > 0) {
      vals.push(scId);
      await db.execute(`UPDATE scheduled_calls SET ${sets.join(', ')} WHERE id = ?`, vals);
    }

    // Reset reminder if time changed
    if (parsed.scheduled_at !== undefined) {
      await db.execute(`UPDATE scheduled_calls SET reminder_sent = 0 WHERE id = ?`, [scId]);
    }

    const updated = await db.queryOne<any>(
      `SELECT sc.*, u.name AS creator_name, u.email AS creator_email, u.avatar_url AS creator_avatar
       FROM scheduled_calls sc
       LEFT JOIN users u ON u.id = sc.created_by
       WHERE sc.id = ?`,
      [scId],
    );

    emitScheduledCall(call.conversation_id, 'updated', updated);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /staff-chat/scheduled-calls/:id
 * Cancel a scheduled call (creator only).
 */
staffChatRouter.delete('/scheduled-calls/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const scId = req.params.id;

    const call = await db.queryOne<any>(`SELECT * FROM scheduled_calls WHERE id = ?`, [scId]);
    if (!call) throw notFound('Scheduled call not found');
    if (call.created_by !== userId) throw forbidden('Only the creator can cancel this call');
    if (call.status !== 'scheduled') throw badRequest('Cannot cancel a call that is not scheduled');

    await db.execute(`UPDATE scheduled_calls SET status = 'cancelled' WHERE id = ?`, [scId]);

    emitScheduledCall(call.conversation_id, 'cancelled', { id: Number(scId) });

    // Notify participants
    const participants = await db.query<{ user_id: string }>(
      `SELECT user_id FROM scheduled_call_participants WHERE scheduled_call_id = ?`,
      [scId],
    );
    const creator = await db.queryOne<any>(`SELECT name, email FROM users WHERE id = ?`, [userId]);
    const creatorName = creator?.name || creator?.email || 'Someone';

    for (const p of participants) {
      if (p.user_id === userId) continue;
      try {
        const online = await isUserOnline(p.user_id);
        if (online) continue;
        await sendPushToUser(p.user_id, {
          title: '❌ Scheduled call cancelled',
          body: `${creatorName} cancelled "${call.title}"`,
          data: { type: 'scheduled_call_cancelled', conversationId: String(call.conversation_id), link: `/chat?c=${call.conversation_id}` },
        });
      } catch { /* ignore */ }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /staff-chat/scheduled-calls/:id/rsvp
 * Accept or decline a scheduled call invitation.
 */
staffChatRouter.post('/scheduled-calls/:id/rsvp', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const scId = req.params.id;
    const { rsvp } = z.object({ rsvp: z.enum(['accepted', 'declined']) }).parse(req.body);

    const call = await db.queryOne<any>(`SELECT * FROM scheduled_calls WHERE id = ?`, [scId]);
    if (!call) throw notFound('Scheduled call not found');
    if (call.status !== 'scheduled') throw badRequest('Cannot RSVP to a call that is not in scheduled state');

    const participant = await db.queryOne<any>(
      `SELECT * FROM scheduled_call_participants WHERE scheduled_call_id = ? AND user_id = ?`,
      [scId, userId],
    );
    if (!participant) throw forbidden('Not a participant of this call');

    await db.execute(
      `UPDATE scheduled_call_participants SET rsvp = ? WHERE scheduled_call_id = ? AND user_id = ?`,
      [rsvp, scId, userId],
    );

    const user = await db.queryOne<any>(`SELECT name, email FROM users WHERE id = ?`, [userId]);
    const userName = user?.name || user?.email || 'Someone';

    emitScheduledCall(call.conversation_id, 'rsvp', {
      scheduledCallId: Number(scId),
      userId,
      userName,
      rsvp,
    });

    // Notify the call creator about the RSVP response (push to offline creator)
    if (call.created_by !== userId) {
      try {
        const creatorOnline = await isUserOnline(call.created_by);
        if (!creatorOnline) {
          const emoji = rsvp === 'accepted' ? '✅' : '❌';
          await sendPushToUser(call.created_by, {
            title: `${emoji} RSVP: ${call.title}`,
            body: `${userName} ${rsvp} your scheduled call`,
            data: {
              type: 'scheduled_call_rsvp',
              conversationId: String(call.conversation_id),
              scheduledCallId: String(scId),
              link: `/chat?c=${call.conversation_id}`,
            },
          });
        }
      } catch { /* don't fail RSVP if push fails */ }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /staff-chat/scheduled-calls/:id/start
 * Start a scheduled call — creates a real call_session and transitions status to 'active'.
 * The frontend then initiates WebRTC signaling using the returned call_id.
 */
staffChatRouter.post('/scheduled-calls/:id/start', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const scId = req.params.id;

    const scheduled = await db.queryOne<any>(`SELECT * FROM scheduled_calls WHERE id = ?`, [scId]);
    if (!scheduled) throw notFound('Scheduled call not found');
    if (scheduled.status !== 'scheduled') throw badRequest('Call is not in scheduled state');

    // Verify user is a participant
    const participant = await db.queryOne<any>(
      `SELECT * FROM scheduled_call_participants WHERE scheduled_call_id = ? AND user_id = ?`,
      [scId, userId],
    );
    if (!participant) throw forbidden('Not a participant of this call');

    // Check if there's already an active call in the conversation
    const existing = await db.queryOne<any>(
      `SELECT id FROM call_sessions WHERE conversation_id = ? AND status IN ('ringing', 'active')`,
      [scheduled.conversation_id],
    );
    if (existing) throw badRequest('There is already an active call in this conversation');

    // Create the real call session
    const callId = await db.insert(
      `INSERT INTO call_sessions (conversation_id, type, initiated_by, status) VALUES (?, ?, ?, 'ringing')`,
      [scheduled.conversation_id, scheduled.call_type, userId],
    );

    // Add accepted participants to call_participants
    const acceptedParticipants = await db.query<{ user_id: string }>(
      `SELECT user_id FROM scheduled_call_participants WHERE scheduled_call_id = ? AND rsvp = 'accepted'`,
      [scId],
    );
    for (const p of acceptedParticipants) {
      await db.execute(
        `INSERT INTO call_participants (call_id, user_id, joined_at) VALUES (?, ?, ?)`,
        [callId, p.user_id, p.user_id === userId ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null],
      );
    }

    // Update scheduled call to active + link to call_session
    await db.execute(
      `UPDATE scheduled_calls SET status = 'active', call_session_id = ? WHERE id = ?`,
      [callId, scId],
    );

    // Emit ringing to conversation
    const caller = await db.queryOne<any>(`SELECT name, email FROM users WHERE id = ?`, [userId]);
    const callerName = caller?.name || caller?.email || 'Unknown';

    emitCallRinging(scheduled.conversation_id, {
      callId: Number(callId),
      callType: scheduled.call_type,
      callerId: userId,
      callerName,
      conversationName: null,
    });

    // Push notify offline participants
    for (const p of acceptedParticipants) {
      if (p.user_id === userId) continue;
      try {
        const online = await isUserOnline(p.user_id);
        if (online) continue;
        await sendPushToUser(p.user_id, {
          title: `Incoming ${scheduled.call_type} call`,
          body: `${callerName} is starting the scheduled call: "${scheduled.title}"${scheduled.screen_share ? ' (screen sharing)' : ''}`,
          data: {
            type: 'incoming_call',
            callId: String(callId),
            callType: scheduled.call_type,
            conversationId: String(scheduled.conversation_id),
            callerId: userId,
            callerName,
            scheduledCallId: String(scId),
            link: `/chat?c=${scheduled.conversation_id}`,
          },
        });
      } catch { /* ignore */ }
    }

    // 45-second auto-miss timeout (in-process safety net)
    setTimeout(async () => {
      try {
        const session = await db.queryOne<any>(`SELECT status FROM call_sessions WHERE id = ?`, [callId]);
        if (session?.status === 'ringing') {
          await db.execute(`UPDATE call_sessions SET status = 'missed', ended_at = NOW() WHERE id = ?`, [callId]);
          await db.execute(`UPDATE call_participants SET left_at = NOW() WHERE call_id = ? AND left_at IS NULL`, [callId]);
          await db.execute(`UPDATE scheduled_calls SET status = 'scheduled', call_session_id = NULL WHERE id = ? AND status = 'active'`, [scId]);
          emitCallMissed(scheduled.conversation_id, Number(callId));
        }
      } catch { /* ignore */ }
    }, 45_000);

    res.json({
      success: true,
      data: {
        call_id: Number(callId),
        conversation_id: scheduled.conversation_id,
        call_type: scheduled.call_type,
        screen_share: !!scheduled.screen_share,
        status: 'ringing',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /staff-chat/scheduled-calls/:id/participants
 * Add participants to an existing scheduled call (creator only).
 */
staffChatRouter.post('/scheduled-calls/:id/participants', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const scId = req.params.id;
    const { user_ids } = z.object({ user_ids: z.array(z.string()).min(1) }).parse(req.body);

    const call = await db.queryOne<any>(`SELECT * FROM scheduled_calls WHERE id = ?`, [scId]);
    if (!call) throw notFound('Scheduled call not found');
    if (call.created_by !== userId) throw forbidden('Only the creator can manage participants');
    if (call.status !== 'scheduled') throw badRequest('Cannot modify participants of a non-scheduled call');

    // Verify all user_ids are conversation members
    const members = await db.query<{ user_id: string }>(
      `SELECT user_id FROM conversation_members WHERE conversation_id = ? AND removed_at IS NULL AND user_id IN (${user_ids.map(() => '?').join(',')})`,
      [call.conversation_id, ...user_ids],
    );
    const validIds = new Set(members.map(m => m.user_id));
    const toAdd = user_ids.filter(id => validIds.has(id));

    if (toAdd.length === 0) throw badRequest('No valid conversation members in the provided list');

    // Batch insert with IGNORE to skip duplicates
    const placeholders = toAdd.map(() => '(?, ?, \'pending\')').join(', ');
    const values = toAdd.flatMap(id => [scId, id]);
    await db.execute(
      `INSERT IGNORE INTO scheduled_call_participants (scheduled_call_id, user_id, rsvp) VALUES ${placeholders}`,
      values,
    );

    // Fetch updated participants
    const participants = await db.query<any>(
      `SELECT scp.user_id, scp.rsvp, scp.created_at,
              u.name, u.email, u.avatar_url
       FROM scheduled_call_participants scp
       LEFT JOIN users u ON u.id = scp.user_id
       WHERE scp.scheduled_call_id = ?`,
      [scId],
    );

    emitScheduledCall(call.conversation_id, 'updated', { id: Number(scId), participants });

    // Push notify new participants
    for (const pid of toAdd) {
      try {
        const online = await isUserOnline(pid);
        if (online) continue;
        await sendPushToUser(pid, {
          title: '📅 Added to scheduled call',
          body: `You were added to "${call.title}"`,
          data: { type: 'scheduled_call', conversationId: String(call.conversation_id), scheduledCallId: String(scId), link: `/chat?c=${call.conversation_id}` },
        });
      } catch { /* ignore */ }
    }

    res.json({ success: true, data: { added: toAdd.length, participants } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /staff-chat/scheduled-calls/:id/participants/:userId
 * Remove a participant from a scheduled call (creator only, cannot remove self).
 */
staffChatRouter.delete('/scheduled-calls/:id/participants/:userId', async (req: AuthRequest, res: Response, next) => {
  try {
    const { userId } = getAuth(req);
    const scId = req.params.id;
    const targetUserId = req.params.userId;

    const call = await db.queryOne<any>(`SELECT * FROM scheduled_calls WHERE id = ?`, [scId]);
    if (!call) throw notFound('Scheduled call not found');
    if (call.created_by !== userId) throw forbidden('Only the creator can manage participants');
    if (call.status !== 'scheduled') throw badRequest('Cannot modify participants of a non-scheduled call');
    if (targetUserId === userId) throw badRequest('Cannot remove yourself from the call');

    const affected = await db.execute(
      `DELETE FROM scheduled_call_participants WHERE scheduled_call_id = ? AND user_id = ?`,
      [scId, targetUserId],
    );
    if (affected === 0) throw notFound('Participant not found');

    emitScheduledCall(call.conversation_id, 'updated', { id: Number(scId), removedUserId: targetUserId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════
// SCHEDULED CALL MAINTENANCE (cleanup, reminders, recurrence)
// ═════════════════════════════════════════════════════════════

/**
 * Cleanup stale ringing calls that got stuck (e.g. server restart during timeout).
 * Runs every 2 minutes. Marks calls ringing for > 2 minutes as missed and reverts
 * the linked scheduled_call back to 'scheduled'.
 */
let _cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startScheduledCallMaintenance(): void {
  if (_cleanupInterval) return;

  _cleanupInterval = setInterval(async () => {
    try {
      // Issue #6: Clean up stale ringing sessions
      const stale = await db.query<any>(
        `SELECT cs.id AS call_id, cs.conversation_id, sc.id AS sc_id
         FROM call_sessions cs
         LEFT JOIN scheduled_calls sc ON sc.call_session_id = cs.id
         WHERE cs.status = 'ringing' AND cs.started_at < NOW() - INTERVAL 2 MINUTE`,
      );
      for (const row of stale) {
        await db.execute(`UPDATE call_sessions SET status = 'missed', ended_at = NOW() WHERE id = ?`, [row.call_id]);
        await db.execute(`UPDATE call_participants SET left_at = NOW() WHERE call_id = ? AND left_at IS NULL`, [row.call_id]);
        if (row.sc_id) {
          await db.execute(`UPDATE scheduled_calls SET status = 'scheduled', call_session_id = NULL WHERE id = ? AND status = 'active'`, [row.sc_id]);
        }
        emitCallMissed(row.conversation_id, row.call_id);
      }

      // Issue #7: Send reminders 15 minutes before scheduled time
      const upcoming = await db.query<any>(
        `SELECT sc.id, sc.conversation_id, sc.title, sc.call_type, sc.scheduled_at, sc.screen_share
         FROM scheduled_calls sc
         WHERE sc.status = 'scheduled'
           AND sc.reminder_sent = 0
           AND sc.scheduled_at <= NOW() + INTERVAL 15 MINUTE
           AND sc.scheduled_at > NOW()`,
      );
      for (const call of upcoming) {
        await db.execute(`UPDATE scheduled_calls SET reminder_sent = 1 WHERE id = ?`, [call.id]);

        const participants = await db.query<{ user_id: string }>(
          `SELECT user_id FROM scheduled_call_participants WHERE scheduled_call_id = ? AND rsvp != 'declined'`,
          [call.id],
        );

        const schedDate = new Date(call.scheduled_at);
        const timeStr = schedDate.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

        // Emit socket reminder
        emitScheduledCall(call.conversation_id, 'reminder', {
          id: call.id,
          title: call.title,
          scheduled_at: call.scheduled_at,
        });

        // Push notify offline participants
        for (const p of participants) {
          try {
            const online = await isUserOnline(p.user_id);
            if (online) continue;
            await sendPushToUser(p.user_id, {
              title: `⏰ Call starting soon`,
              body: `"${call.title}" starts at ${timeStr}`,
              data: { type: 'scheduled_call_reminder', conversationId: String(call.conversation_id), scheduledCallId: String(call.id), link: `/chat?c=${call.conversation_id}` },
            });
          } catch { /* ignore */ }
        }
      }

      // Issue #2: Spawn next occurrence for completed recurring calls
      const completedRecurring = await db.query<any>(
        `SELECT * FROM scheduled_calls
         WHERE status = 'completed'
           AND recurrence != 'none'
           AND (recurrence_end IS NULL OR recurrence_end > NOW())`,
      );
      for (const call of completedRecurring) {
        // Calculate next occurrence
        const prev = new Date(call.scheduled_at);
        let next: Date;
        switch (call.recurrence) {
          case 'daily':    next = new Date(prev.getTime() + 86400000); break;
          case 'weekly':   next = new Date(prev.getTime() + 7 * 86400000); break;
          case 'biweekly': next = new Date(prev.getTime() + 14 * 86400000); break;
          case 'monthly':  next = new Date(prev); next.setMonth(next.getMonth() + 1); break;
          default: continue;
        }

        // Skip if next occurrence is past recurrence_end
        if (call.recurrence_end && next > new Date(call.recurrence_end)) {
          // Mark recurrence as done by setting recurrence to 'none'
          await db.execute(`UPDATE scheduled_calls SET recurrence = 'none' WHERE id = ?`, [call.id]);
          continue;
        }

        // Skip if next occurrence is in the past
        if (next < new Date()) continue;

        // Check if a future call already exists for this series (avoid duplicates)
        const existing = await db.queryOne<any>(
          `SELECT id FROM scheduled_calls
           WHERE conversation_id = ? AND created_by = ? AND title = ? AND status = 'scheduled'
             AND scheduled_at = ?`,
          [call.conversation_id, call.created_by, call.title, next.toISOString().slice(0, 19).replace('T', ' ')],
        );
        if (existing) continue;

        // Create next occurrence
        const nextId = await db.insert(
          `INSERT INTO scheduled_calls
            (conversation_id, created_by, title, description, call_type, screen_share,
             scheduled_at, duration_minutes, recurrence, recurrence_end, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
          [
            call.conversation_id, call.created_by, call.title, call.description,
            call.call_type, call.screen_share, next.toISOString().slice(0, 19).replace('T', ' '),
            call.duration_minutes, call.recurrence, call.recurrence_end,
          ],
        );

        // Copy participants from the completed call (reset RSVP: creator → accepted, others → pending)
        const participants = await db.query<{ user_id: string; rsvp: string }>(
          `SELECT user_id, rsvp FROM scheduled_call_participants WHERE scheduled_call_id = ?`,
          [call.id],
        );
        if (participants.length > 0) {
          const placeholders = participants.map(() => '(?, ?, ?)').join(', ');
          const values = participants.flatMap(p => [nextId, p.user_id, p.user_id === call.created_by ? 'accepted' : 'pending']);
          await db.execute(
            `INSERT INTO scheduled_call_participants (scheduled_call_id, user_id, rsvp) VALUES ${placeholders}`,
            values,
          );
        }

        // Clear recurrence on the completed call so it doesn't spawn again
        await db.execute(`UPDATE scheduled_calls SET recurrence = 'none' WHERE id = ?`, [call.id]);

        // Notify
        emitScheduledCall(call.conversation_id, 'created', { id: Number(nextId), title: call.title, scheduled_at: next.toISOString(), recurrence: call.recurrence });
      }
    } catch (err) {
      console.error('[ScheduledCalls] Maintenance error:', err);
    }
  }, 2 * 60 * 1000); // Every 2 minutes
}

// Start the maintenance loop when the module loads
startScheduledCallMaintenance();

// ═════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════

/**
 * Generate link preview for a message asynchronously.
 * Updates the message's link_preview_json column and emits update via socket.
 */
async function generateLinkPreview(
  messageId: number,
  conversationId: number,
  content: string,
): Promise<void> {
  try {
    const preview = await getLinkPreviewForContent(content);
    if (!preview) return;

    await db.execute(
      'UPDATE messages SET link_preview_json = ? WHERE id = ?',
      [JSON.stringify(preview), messageId],
    );

    // Emit an update so connected clients can render the preview
    emitConversationUpdated(conversationId, {
      id: conversationId,
      _link_preview: { messageId, preview },
    } as any);
  } catch (err) {
    console.error('[StaffChat] Link preview generation failed:', err);
  }
}

/** Send push notification to offline members (fire-and-forget) */
async function pushToOfflineMembers(
  memberIds: string[],
  conversationId: string | number,
  message: any,
  senderId: string,
): Promise<void> {
  // Parse @mention user IDs from message content
  // Supports both @DisplayName and @userId formats
  const mentionedUserIds = new Set<string>();
  if (message.content) {
    try {
      // 1. Check for direct @userId references (UUID format)
      const uuidMentions = message.content.match(/@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi);
      if (uuidMentions) {
        for (const match of uuidMentions) {
          mentionedUserIds.add(match.slice(1));
        }
      }

      // 2. Check for @DisplayName mentions (look up by name)
      const nameMentions = message.content.match(/@([a-zA-Z][a-zA-Z0-9_\- ]{1,50})/g);
      if (nameMentions) {
        const names = nameMentions
          .map((m: string) => m.slice(1).trim())
          .filter((n: string) => n.length >= 2 && !/^[0-9a-f]{8}-/.test(n)); // skip UUIDs
        for (const name of names) {
          const user = await db.queryOne<any>(
            `SELECT id FROM users
             WHERE LOWER(name) = LOWER(?)
                OR LOWER(name) LIKE LOWER(?)
             LIMIT 1`,
            [name, `${name}%`],
          );
          if (user) mentionedUserIds.add(user.id);
        }
      }
    } catch {
      // Silently ignore mention parsing errors
    }
  }

  for (const memberId of memberIds) {
    try {
      if (memberId === senderId) continue; // don't push to sender

      // ── Check user-level notification preferences ──────
      const userPrefs = await db.queryOne<{
        notifications_enabled: number | boolean;
        push_notifications_enabled: number | boolean;
      }>(
        `SELECT notifications_enabled, push_notifications_enabled FROM users WHERE id = ?`,
        [memberId],
      );
      // Master toggle off → skip entirely
      if (userPrefs && userPrefs.notifications_enabled === false || userPrefs?.notifications_enabled === 0) continue;
      // Push toggle off → skip push (user may still get in-app via socket)
      if (userPrefs && userPrefs.push_notifications_enabled === false || userPrefs?.push_notifications_enabled === 0) continue;

      const isMentioned = mentionedUserIds.has(memberId);

      // Check if muted (but skip mute check if @mentioned)
      // Also fetch notification_sound preference
      let notificationSound: string | null = null;
      if (!isMentioned) {
        const membership = await db.queryOne<any>(
          `SELECT muted_until, notification_sound FROM conversation_members
           WHERE conversation_id = ? AND user_id = ? AND removed_at IS NULL`,
          [conversationId, memberId],
        );
        if (membership?.muted_until && new Date(membership.muted_until) > new Date()) {
          continue; // muted and not mentioned — skip
        }
        notificationSound = membership?.notification_sound || null;
      } else {
        // Still fetch the sound preference for mentioned users
        const membership = await db.queryOne<any>(
          `SELECT notification_sound FROM conversation_members
           WHERE conversation_id = ? AND user_id = ? AND removed_at IS NULL`,
          [conversationId, memberId],
        );
        notificationSound = membership?.notification_sound || null;
      }

      // Check DND schedule (but skip if @mentioned)
      if (!isMentioned) {
        const dnd = await db.queryOne<{ dnd_enabled: number; dnd_start: string | null; dnd_end: string | null }>(
          `SELECT dnd_enabled, dnd_start, dnd_end FROM user_presence WHERE user_id = ?`,
          [memberId],
        );
        if (dnd?.dnd_enabled && dnd.dnd_start && dnd.dnd_end) {
          const now = new Date();
          const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
          const start = dnd.dnd_start;
          const end = dnd.dnd_end;
          // Handle overnight ranges (e.g. 22:00 → 07:00)
          const inDnd = start <= end
            ? (nowTime >= start && nowTime < end)
            : (nowTime >= start || nowTime < end);
          if (inDnd) continue; // In DND window — skip push
        }
      }

      // Check if online
      const online = await isUserOnline(memberId);
      if (online) continue; // connected to socket — skip push

      // Calculate total unread count for badge
      let badgeCount = 0;
      try {
        const result = await db.queryOne<{ total: number }>(`
          SELECT COALESCE(SUM(
            (SELECT COUNT(*) FROM messages m2
             WHERE m2.conversation_id = cm.conversation_id
               AND m2.id > COALESCE(cm.last_read_message_id, 0)
               AND m2.sender_id != ?
               AND m2.deleted_for_everyone_at IS NULL)
          ), 0) AS total
          FROM conversation_members cm
          WHERE cm.user_id = ? AND cm.removed_at IS NULL
        `, [memberId, memberId]);
        badgeCount = result?.total || 0;
      } catch {
        // Non-critical — proceed without badge count
      }

      // Build preview
      let body = message.content || '';
      if (message.message_type === 'image') body = '📷 Photo';
      else if (message.message_type === 'video') body = '🎥 Video';
      else if (message.message_type === 'audio') body = '🎤 Voice message';
      else if (message.message_type === 'file') body = `📎 ${message.file_name || 'File'}`;
      else if (message.message_type === 'gif') body = 'GIF';
      else if (message.message_type === 'location') body = '📍 Location';
      else if (message.message_type === 'contact') body = '👤 Contact';

      if (body.length > 100) body = body.substring(0, 97) + '...';

      const title = isMentioned
        ? `${message.sender_name || 'Someone'} mentioned you`
        : (message.sender_name || 'New message');

      await sendPushToUser(memberId, {
        title,
        body,
        data: {
          type: isMentioned ? 'chat_mention' : 'chat_message',
          conversationId: String(conversationId),
          messageId: String(message.id),
          senderName: message.sender_name || '',
          messageType: message.message_type,
          badge: String(badgeCount),
          mentioned: isMentioned ? 'true' : 'false',
          sound: notificationSound || 'default',
          link: `/chat?c=${conversationId}`,
        },
      });
    } catch (err) {
      // Don't fail the message send if push fails
      console.error('[StaffChat] Push notification error for', memberId, err);
    }
  }
}
