import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from '../db/mysql.js';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { badRequest, notFound, forbidden } from '../utils/httpErrors.js';
import { emitTeamMessage, emitTeamUpdated, emitTeamMembersChanged, emitTeamMessageDeleted, emitTeamDeleted, } from '../services/teamChatSocket.js';
export const teamChatRouter = Router();
teamChatRouter.use(requireAuth);
/* ═══════════════════════════════════════════════════════════════
   Team Chat — local DB-backed group chat (called "teams" in code)
   Tables: team_chats, team_chat_members, team_chat_messages
   ═══════════════════════════════════════════════════════════════ */
// ── Zod schemas ─────────────────────────────────────────────
const createTeamSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
});
const updateTeamSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
});
const sendMessageSchema = z.object({
    content: z.string().min(1).max(5000),
    message_type: z.enum(['text', 'image', 'video', 'audio', 'file']).default('text'),
    file_url: z.string().optional(),
    file_name: z.string().optional(),
    file_type: z.string().optional(),
    file_size: z.number().optional(),
    reply_to_id: z.string().optional(),
});
const addMembersSchema = z.object({
    user_ids: z.array(z.string()).min(1),
});
/**
 * GET /users/available — list users that can be added to teams
 * Returns all active users (for the member picker)
 * NOTE: This must be registered BEFORE /:id routes to avoid Express matching "users" as an :id param
 */
teamChatRouter.get('/users/available', async (req, res, next) => {
    try {
        getAuth(req); // ensure authenticated
        const users = await db.query(`
      SELECT id, first_name, last_name, email,
        COALESCE(CONCAT(first_name, ' ', last_name), email) AS display_name
      FROM users
      WHERE active = 1
      ORDER BY first_name, last_name
    `);
        res.json({ success: true, data: users });
    }
    catch (err) {
        next(err);
    }
});
// ── Helpers ─────────────────────────────────────────────────
async function requireMembership(teamId, userId) {
    const member = await db.queryOne('SELECT * FROM team_chat_members WHERE team_id = ? AND user_id = ? AND removed_at IS NULL', [teamId, userId]);
    if (!member)
        throw forbidden('Not a member of this team');
    return member;
}
// ─────────────────────────────────────────────────────────────
// TEAM CRUD
// ─────────────────────────────────────────────────────────────
/**
 * GET / — list all teams the current user is a member of
 * Returns team list with member_count, last_message, last_message_at
 */
teamChatRouter.get('/', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teams = await db.query(`
      SELECT
        t.id,
        t.name,
        t.description,
        t.created_by,
        t.created_at,
        (SELECT COUNT(*) FROM team_chat_members tcm WHERE tcm.team_id = t.id AND tcm.removed_at IS NULL) AS member_count,
        (SELECT m.content FROM team_chat_messages m WHERE m.team_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
        (SELECT m.created_at FROM team_chat_messages m WHERE m.team_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
      FROM team_chats t
      INNER JOIN team_chat_members tcm ON tcm.team_id = t.id AND tcm.user_id = ? AND tcm.removed_at IS NULL
      ORDER BY last_message_at DESC, t.created_at DESC
    `, [userId]);
        res.json({ success: true, data: teams });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST / — create a new team
 * Creator is automatically added as 'admin' member
 */
teamChatRouter.post('/', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const input = createTeamSchema.parse(req.body);
        const id = await db.insert('INSERT INTO team_chats (name, description, created_by, created_at) VALUES (?, ?, ?, NOW())', [input.name, input.description || null, userId]);
        // Add creator as admin member
        await db.insert('INSERT INTO team_chat_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, NOW())', [id, userId, 'admin']);
        const team = await db.queryOne('SELECT * FROM team_chats WHERE id = ?', [id]);
        res.status(201).json({ success: true, data: team });
    }
    catch (err) {
        next(err);
    }
});
/**
 * GET /:id — get single team details + members
 */
teamChatRouter.get('/:id', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teamId = req.params.id;
        await requireMembership(teamId, userId);
        const team = await db.queryOne('SELECT * FROM team_chats WHERE id = ?', [teamId]);
        if (!team)
            throw notFound('Team not found');
        const members = await db.query(`
      SELECT
        tcm.user_id,
        tcm.role,
        tcm.joined_at,
        u.first_name,
        u.last_name,
        u.email,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.email) AS display_name
      FROM team_chat_members tcm
      LEFT JOIN users u ON u.id = tcm.user_id
      WHERE tcm.team_id = ? AND tcm.removed_at IS NULL
      ORDER BY tcm.joined_at ASC
    `, [teamId]);
        res.json({ success: true, data: { ...team, members } });
    }
    catch (err) {
        next(err);
    }
});
/**
 * PUT /:id — update team name/description
 * Only admin or creator can update
 */
teamChatRouter.put('/:id', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teamId = req.params.id;
        const input = updateTeamSchema.parse(req.body);
        const member = await requireMembership(teamId, userId);
        if (member.role !== 'admin')
            throw forbidden('Only admin can update team');
        const updates = [];
        const params = [];
        if (input.name !== undefined) {
            updates.push('name = ?');
            params.push(input.name);
        }
        if (input.description !== undefined) {
            updates.push('description = ?');
            params.push(input.description);
        }
        if (updates.length === 0)
            throw badRequest('No fields to update');
        updates.push('updated_at = NOW()');
        params.push(teamId);
        await db.execute(`UPDATE team_chats SET ${updates.join(', ')} WHERE id = ?`, params);
        const team = await db.queryOne('SELECT * FROM team_chats WHERE id = ?', [teamId]);
        res.json({ success: true, data: team });
        // Notify connected clients
        if (team)
            emitTeamUpdated(parseInt(teamId), team);
    }
    catch (err) {
        next(err);
    }
});
/**
 * DELETE /:id — delete team (admin only)
 * Cascades: removes messages and members
 */
teamChatRouter.delete('/:id', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teamId = req.params.id;
        const member = await requireMembership(teamId, userId);
        if (member.role !== 'admin')
            throw forbidden('Only admin can delete team');
        // Notify before deletion so clients still have the room
        emitTeamDeleted(parseInt(teamId));
        await db.execute('DELETE FROM team_chat_messages WHERE team_id = ?', [teamId]);
        await db.execute('DELETE FROM team_chat_members WHERE team_id = ?', [teamId]);
        await db.execute('DELETE FROM team_chats WHERE id = ?', [teamId]);
        res.json({ success: true, message: 'Team deleted' });
    }
    catch (err) {
        next(err);
    }
});
// ─────────────────────────────────────────────────────────────
// MEMBERS
// ─────────────────────────────────────────────────────────────
/**
 * POST /:id/members — add members to team
 */
teamChatRouter.post('/:id/members', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teamId = req.params.id;
        const input = addMembersSchema.parse(req.body);
        const member = await requireMembership(teamId, userId);
        if (member.role !== 'admin')
            throw forbidden('Only admin can add members');
        const team = await db.queryOne('SELECT * FROM team_chats WHERE id = ?', [teamId]);
        if (!team)
            throw notFound('Team not found');
        let added = 0;
        for (const uid of input.user_ids) {
            // Check if already a member (even if removed — re-add)
            const existing = await db.queryOne('SELECT * FROM team_chat_members WHERE team_id = ? AND user_id = ?', [teamId, uid]);
            if (existing && !existing.removed_at)
                continue; // already active member
            if (existing) {
                // Re-add previously removed member
                await db.execute('UPDATE team_chat_members SET removed_at = NULL, joined_at = NOW() WHERE team_id = ? AND user_id = ?', [teamId, uid]);
            }
            else {
                await db.insert('INSERT INTO team_chat_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, NOW())', [teamId, uid, 'member']);
            }
            added++;
        }
        res.json({ success: true, added });
        // Notify connected clients about membership change
        if (added > 0)
            emitTeamMembersChanged(parseInt(teamId));
    }
    catch (err) {
        next(err);
    }
});
/**
 * DELETE /:id/members/:userId — remove member from team
 */
teamChatRouter.delete('/:id/members/:userId', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teamId = req.params.id;
        const targetUserId = req.params.userId;
        const member = await requireMembership(teamId, userId);
        // Admin can remove anyone; members can leave themselves
        if (member.role !== 'admin' && userId !== targetUserId) {
            throw forbidden('Only admin can remove members');
        }
        await db.execute('UPDATE team_chat_members SET removed_at = NOW() WHERE team_id = ? AND user_id = ?', [teamId, targetUserId]);
        res.json({ success: true, message: 'Member removed' });
        // Notify connected clients about membership change
        emitTeamMembersChanged(parseInt(teamId));
    }
    catch (err) {
        next(err);
    }
});
// ─────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────
/**
 * GET /:id/messages — list messages for a team (paginated, oldest first)
 * Query params: limit (default 100), before (ISO date for cursor pagination)
 */
teamChatRouter.get('/:id/messages', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teamId = req.params.id;
        await requireMembership(teamId, userId);
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const before = req.query.before;
        let sql = `
      SELECT
        m.id,
        m.team_id,
        m.user_id,
        m.content,
        m.message_type,
        m.file_url,
        m.file_name,
        m.file_type,
        m.file_size,
        m.reply_to_id,
        m.created_at,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.email, 'Unknown') AS user_name,
        rm.content AS reply_to_content,
        COALESCE(CONCAT(ru.first_name, ' ', ru.last_name), ru.email) AS reply_to_user_name
      FROM team_chat_messages m
      LEFT JOIN users u ON u.id = m.user_id
      LEFT JOIN team_chat_messages rm ON rm.id = m.reply_to_id
      LEFT JOIN users ru ON ru.id = rm.user_id
      WHERE m.team_id = ?
    `;
        const params = [teamId];
        if (before) {
            sql += ' AND m.created_at < ?';
            params.push(before);
        }
        sql += ' ORDER BY m.created_at ASC LIMIT ?';
        params.push(limit);
        const messages = await db.query(sql, params);
        res.json({ success: true, data: messages });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /:id/messages — send a message to the team
 */
teamChatRouter.post('/:id/messages', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teamId = req.params.id;
        await requireMembership(teamId, userId);
        const input = sendMessageSchema.parse(req.body);
        const msgId = await db.insert(`INSERT INTO team_chat_messages
        (team_id, user_id, content, message_type, file_url, file_name, file_type, file_size, reply_to_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`, [
            teamId,
            userId,
            input.content,
            input.message_type,
            input.file_url || null,
            input.file_name || null,
            input.file_type || null,
            input.file_size || null,
            input.reply_to_id || null,
        ]);
        // Fetch the full message with user info to return
        const message = await db.queryOne(`
      SELECT
        m.id,
        m.team_id,
        m.user_id,
        m.content,
        m.message_type,
        m.file_url,
        m.file_name,
        m.file_type,
        m.file_size,
        m.reply_to_id,
        m.created_at,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.email, 'Unknown') AS user_name
      FROM team_chat_messages m
      LEFT JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `, [msgId]);
        res.status(201).json({ success: true, data: message });
        // Broadcast new message to team room
        if (message)
            emitTeamMessage(parseInt(teamId), message);
    }
    catch (err) {
        next(err);
    }
});
/**
 * DELETE /:id/messages/:msgId — delete a message (own message or admin)
 */
teamChatRouter.delete('/:id/messages/:msgId', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teamId = req.params.id;
        const msgId = req.params.msgId;
        const member = await requireMembership(teamId, userId);
        const msg = await db.queryOne('SELECT * FROM team_chat_messages WHERE id = ? AND team_id = ?', [msgId, teamId]);
        if (!msg)
            throw notFound('Message not found');
        // Only the sender or an admin can delete
        if (msg.user_id !== userId && member.role !== 'admin') {
            throw forbidden('Cannot delete this message');
        }
        await db.execute('DELETE FROM team_chat_messages WHERE id = ?', [msgId]);
        res.json({ success: true, message: 'Message deleted' });
        // Notify connected clients about message deletion
        emitTeamMessageDeleted(parseInt(teamId), parseInt(msgId));
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /:id/upload — upload a file for a team message
 * Accepts base64 file data, saves to disk, returns the URL
 */
teamChatRouter.post('/:id/upload', async (req, res, next) => {
    try {
        const { userId } = getAuth(req);
        const teamId = req.params.id;
        await requireMembership(teamId, userId);
        const { file_name, file_type, file_data } = req.body;
        if (!file_name || !file_data)
            throw badRequest('file_name and file_data (base64) required');
        // Strip data URI prefix if present
        const base64Data = file_data.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        // Save to uploads/team-chats/<teamId>/
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'team-chats', String(teamId));
        fs.mkdirSync(uploadsDir, { recursive: true });
        const timestamp = Date.now();
        const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${timestamp}_${safeName}`;
        const filePath = path.join(uploadsDir, fileName);
        fs.writeFileSync(filePath, buffer);
        const fileUrl = `/uploads/team-chats/${teamId}/${fileName}`;
        res.json({ success: true, file_url: fileUrl, file_name: safeName, file_type: file_type || 'application/octet-stream', file_size: buffer.length });
    }
    catch (err) {
        next(err);
    }
});
