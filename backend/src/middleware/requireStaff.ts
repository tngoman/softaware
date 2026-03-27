import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { db } from '../db/mysql.js';

/**
 * Middleware to require staff access.
 *
 * Checks the `is_staff` column on the users table directly.
 * Must be chained after requireAuth.
 */
export async function requireStaff(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const row = await db.queryOne<{ is_staff: number }>(
      'SELECT is_staff FROM users WHERE id = ?',
      [userId]
    );

    if (!row || !row.is_staff) {
      res.status(403).json({
        success: false,
        error: 'Staff access required. You do not have permission to perform this action.',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('[requireStaff] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Authorization check failed',
    });
  }
}
