import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { db } from '../db/mysql.js';

/**
 * Middleware to require admin role
 * 
 * Checks if the authenticated user has an admin or super_admin role
 * via the user_roles + roles tables.
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

    // Check if user has admin or super_admin role via user_roles
    const adminRole = await db.queryOne<{ slug: string }>(
      `SELECT r.slug FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
         AND r.slug IN ('admin', 'super_admin')
       LIMIT 1`,
      [userId]
    );

    if (!adminRole) {
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
