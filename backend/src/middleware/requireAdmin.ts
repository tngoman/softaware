import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { db, type team_members } from '../db/mysql.js';

/**
 * Middleware to require admin role
 * 
 * Checks if the authenticated user is an admin at system or team level.
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

    // Check if user has admin role in any team
    const adminMembership = await db.queryOne<team_members>(
      'SELECT * FROM team_members WHERE userId = ? AND role = ? LIMIT 1',
      [userId, 'ADMIN']
    );

    if (!adminMembership) {
      res.status(403).json({
        success: false,
        error: 'Admin access required',
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
