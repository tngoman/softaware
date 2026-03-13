import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { db } from '../db/mysql.js';

/**
 * Middleware to require admin access.
 *
 * Checks the `is_admin` column on the users table directly.
 * Must be used after requireAuth middleware.
 */
export async function requireAdmin(
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

    // Check the is_admin flag directly on the users table
    const row = await db.queryOne<{ is_admin: number }>(
      'SELECT is_admin FROM users WHERE id = ?',
      [userId]
    );

    if (!row || !row.is_admin) {
      res.status(403).json({
        success: false,
        error: 'Administrator access required. You do not have permission to perform this action.',
      });
      return;
    }

    // User is admin, continue
    next();
  } catch (error) {
    console.error('[requireAdmin] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Authorization check failed',
    });
  }
}
