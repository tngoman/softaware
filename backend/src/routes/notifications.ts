import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { db } from '../db/mysql.js';
import { sendPushToUser, createNotificationWithPush } from '../services/firebaseService.js';

export const notificationsRouter = Router();

/**
 * GET /notifications
 * List notifications for the authenticated user
 */
notificationsRouter.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const unreadOnly = req.query.unread === 'true';

    let sql = `SELECT * FROM notifications WHERE user_id = ?`;
    if (unreadOnly) {
      sql += ` AND read_at IS NULL`;
    }
    sql += ` ORDER BY created_at DESC LIMIT ?`;

    const notifications = await db.query<any>(sql, [userId, limit]);

    const countRow = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL`,
      [userId]
    );

    res.json({
      success: true,
      data: notifications,
      unread_count: countRow?.count || 0,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /notifications/unread/count
 * Return only the unread count for the authenticated user
 */
notificationsRouter.get('/unread/count', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const row = await db.queryOne<{ count: number }>(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL`,
      [userId]
    );

    res.json({
      success: true,
      data: { count: row?.count || 0 },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /notifications/:id/read
 * Mark a single notification as read
 */
notificationsRouter.put('/:id/read', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    await db.execute(
      `UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?`,
      [req.params.id, userId]
    );
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /notifications/read-all
 * Mark all of the user's notifications as read
 */
notificationsRouter.put('/read-all', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    await db.execute(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL`,
      [userId]
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /notifications/:id
 * Delete a notification
 */
notificationsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    await db.execute(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [req.params.id, userId]
    );
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /notifications — Create a notification (with optional push) ──
const CreateNotificationSchema = z.object({
  user_id: z.string().optional(),   // If omitted, sends to self
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(['info', 'success', 'warning', 'error']).optional().default('info'),
  send_push: z.boolean().optional().default(true),
});

notificationsRouter.post('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const input = CreateNotificationSchema.parse(req.body);
    const targetUserId = input.user_id || req.userId!;

    if (input.send_push) {
      await createNotificationWithPush(targetUserId, {
        title: input.title,
        message: input.message,
        type: input.type,
      });
    } else {
      // In-app notification only, no push
      await db.execute(
        `INSERT INTO notifications (user_id, title, message, type, created_at) VALUES (?, ?, ?, ?, NOW())`,
        [targetUserId, input.title, input.message, input.type],
      );
    }

    res.json({ success: true, message: 'Notification created' });
  } catch (err) {
    next(err);
  }
});

// ─── POST /notifications/test-push — Send a test push to self ─────
notificationsRouter.post('/test-push', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId!;
    const result = await sendPushToUser(userId, {
      title: 'SoftAware Test',
      body: 'If you see this, push notifications are working! 🎉',
      data: { type: 'test' },
    });

    res.json({
      success: true,
      message: `Test push sent. ${result.sent} delivered, ${result.failed} failed.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});
