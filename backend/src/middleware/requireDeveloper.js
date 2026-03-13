import { db } from '../db/mysql.js';
/**
 * Middleware to require developer (or admin) access.
 *
 * Checks the `is_admin` or `is_staff` column on the users table directly.
 * Must be chained after requireAuth.
 */
export async function requireDeveloper(req, res, next) {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
            return;
        }
        const row = await db.queryOne('SELECT is_admin, is_staff FROM users WHERE id = ?', [userId]);
        if (!row || (!row.is_admin && !row.is_staff)) {
            res.status(403).json({
                success: false,
                error: 'Developer or administrator access required. You do not have permission to perform this action.',
            });
            return;
        }
        next();
    }
    catch (error) {
        console.error('[requireDeveloper] Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
}
