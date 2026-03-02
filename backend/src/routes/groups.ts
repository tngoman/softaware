import { Router, Request, Response } from 'express';
import { db } from '../db/mysql.js';

const router = Router();

/* ═══════════════════════════════════════════════════════════════
   Groups / Chat — CRUD for groups + messages stored locally
   ═══════════════════════════════════════════════════════════════ */

// ── GET / — list all groups ─────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const groups = await db.query<any>(`
      SELECT g.*,
        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id) AS member_count,
        (SELECT m.content FROM group_messages m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
        (SELECT m.created_at FROM group_messages m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at
      FROM \`groups\` g
      ORDER BY last_message_at DESC, g.created_at DESC
    `);
    res.json({ success: true, data: groups });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST / — create group ───────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) { res.status(400).json({ success: false, error: 'Name required' }); return; }
    const userId = (req as any).user?.id;
    const id = await db.insert(
      'INSERT INTO `groups` (name, description, created_by, created_at) VALUES (?, ?, ?, NOW())',
      [name, description || null, userId || null]
    );
    // Add creator as member
    if (userId) {
      await db.insert(
        'INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, NOW())',
        [id, userId]
      );
    }
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /:id — delete group ──────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM group_messages WHERE group_id = ?', [id]);
    await db.execute('DELETE FROM group_members WHERE group_id = ?', [id]);
    await db.execute('DELETE FROM `groups` WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /:id/messages — list messages ───────────────────────
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const before = req.query.before as string;

    let sql = `
      SELECT m.*,
        u.first_name, u.last_name, u.email,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), u.email, 'Unknown') AS user_name,
        rm.content AS reply_to_content,
        COALESCE(CONCAT(ru.first_name, ' ', ru.last_name), ru.email) AS reply_to_user
      FROM group_messages m
      LEFT JOIN users u ON u.id = m.user_id
      LEFT JOIN group_messages rm ON rm.id = m.reply_to_id
      LEFT JOIN users ru ON ru.id = rm.user_id
      WHERE m.group_id = ?
    `;
    const params: any[] = [id];

    if (before) {
      sql += ' AND m.created_at < ?';
      params.push(before);
    }
    sql += ' ORDER BY m.created_at ASC LIMIT ?';
    params.push(limit);

    const messages = await db.query<any>(sql, params);
    res.json({ success: true, data: messages });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /:id/messages — send message ───────────────────────
router.post('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, message_type, reply_to_id } = req.body;
    const userId = (req as any).user?.id;

    if (!content && message_type === 'text') {
      res.status(400).json({ success: false, error: 'Message content required' });
      return;
    }

    const msgId = await db.insert(
      'INSERT INTO group_messages (group_id, user_id, content, message_type, reply_to_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [id, userId || null, content || '', message_type || 'text', reply_to_id || null]
    );

    res.json({ success: true, id: msgId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
