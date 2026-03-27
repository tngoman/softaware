/**
 * Admin Sites Management
 *
 * Provides admin-level access to all generated sites across all users.
 * Includes stats, search, override, and delete capabilities.
 */
import express from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { db } from '../db/mysql.js';
import { siteBuilderService } from '../services/siteBuilderService.js';

const router = express.Router();

// ─── Middleware: ensure user is admin/staff ─────────────────────────────
async function requireAdmin(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const user = await db.queryOne<{ role: string }>(
    'SELECT role FROM users WHERE id = ?', [userId]
  );
  if (!user || !['admin', 'staff', 'developer'].includes(user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * GET /api/admin/sites/stats
 * Aggregate statistics for the admin dashboard
 */
router.get('/stats', requireAuth, requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    const stats = await db.queryOne<{
      total_sites: number;
      draft_count: number;
      generating_count: number;
      generated_count: number;
      deployed_count: number;
      failed_count: number;
    }>(`
      SELECT
        COUNT(*) AS total_sites,
        SUM(status = 'draft') AS draft_count,
        SUM(status = 'generating') AS generating_count,
        SUM(status = 'generated') AS generated_count,
        SUM(status = 'deployed') AS deployed_count,
        SUM(status = 'failed') AS failed_count
      FROM generated_sites
    `);

    const totalPages = await db.queryOne<{ cnt: number }>(
      'SELECT COUNT(*) AS cnt FROM site_pages'
    );

    const trialSites = await db.queryOne<{ cnt: number }>(
      `SELECT COUNT(DISTINCT gs.id) AS cnt
       FROM generated_sites gs
       JOIN users u ON u.id = gs.user_id
       JOIN user_contact_link ucl ON ucl.user_id = u.id WHERE cp.status = 'TRIAL'`
    );

    const recentDeployments = await db.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM generated_sites
       WHERE last_deployed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    return res.json({
      success: true,
      stats: {
        ...stats,
        total_pages: totalPages?.cnt || 0,
        trial_sites: trialSites?.cnt || 0,
        recent_deployments: recentDeployments?.cnt || 0,
      },
    });
  } catch (error) {
    console.error('Admin sites stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/admin/sites
 * List all sites with owner info, pagination, search & filter
 */
router.get('/', requireAuth, requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    const {
      search = '',
      status = '',
      page = '1',
      limit = '25',
      sort = 'created_at',
      order = 'DESC',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const wheres: string[] = [];
    const params: any[] = [];

    if (search) {
      wheres.push('(gs.business_name LIKE ? OR u.email LIKE ? OR u.name LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    if (status && ['draft', 'generating', 'generated', 'deployed', 'failed'].includes(status)) {
      wheres.push('gs.status = ?');
      params.push(status);
    }

    const where = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';

    const allowedSorts = ['created_at', 'updated_at', 'business_name', 'status'];
    const sortCol = allowedSorts.includes(sort) ? `gs.${sort}` : 'gs.created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countRow = await db.queryOne<{ total: number }>(
      `SELECT COUNT(*) AS total FROM generated_sites gs JOIN users u ON u.id = gs.user_id ${where}`,
      params
    );

    const rows = await db.query(
      `SELECT gs.id, gs.business_name, gs.tagline, gs.status, gs.max_pages,
              gs.ftp_server, gs.last_deployed_at, gs.generation_error,
              gs.created_at, gs.updated_at,
              u.id AS owner_id, u.email AS owner_email, u.name AS owner_name,
              (SELECT COUNT(*) FROM site_pages sp WHERE sp.site_id = gs.id) AS page_count,
              cp.status AS subscription_status,
              cp.trial_ends_at
       FROM generated_sites gs
       JOIN users u ON u.id = gs.user_id
       LEFT JOIN user_contact_link ucl ON ucl.user_id = u.id
       LEFT AND cp.status IN ('TRIAL','ACTIVE') ${where}
       ORDER BY ${sortCol} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    return res.json({
      success: true,
      sites: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countRow?.total || 0,
        totalPages: Math.ceil((countRow?.total || 0) / limitNum),
      },
    });
  } catch (error) {
    console.error('Admin list sites error:', error);
    return res.status(500).json({ error: 'Failed to list sites' });
  }
});

/**
 * GET /api/admin/sites/:siteId
 * Get a single site with full details
 */
router.get('/:siteId', requireAuth, requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    const site = await siteBuilderService.getSiteById(req.params.siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const pages = await siteBuilderService.getPagesBySiteId(req.params.siteId);

    return res.json({
      success: true,
      site: { ...site, ftp_password: undefined },
      pages: pages.map(p => ({ ...p, generated_html: undefined })),
    });
  } catch (error) {
    console.error('Admin get site error:', error);
    return res.status(500).json({ error: 'Failed to fetch site' });
  }
});

/**
 * PATCH /api/admin/sites/:siteId
 * Admin override — update status, max_pages, etc.
 */
router.patch('/:siteId', requireAuth, requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    const { siteId } = req.params;
    const { status, maxPages } = req.body;

    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    if (status && ['draft', 'generating', 'generated', 'deployed', 'failed'].includes(status)) {
      await db.execute(
        'UPDATE generated_sites SET status = ? WHERE id = ?',
        [status, siteId]
      );
    }

    if (typeof maxPages === 'number' && maxPages >= 1 && maxPages <= 50) {
      await siteBuilderService.setMaxPages(siteId, maxPages);
    }

    const updated = await siteBuilderService.getSiteById(siteId);
    return res.json({
      success: true,
      site: { ...updated, ftp_password: undefined },
    });
  } catch (error) {
    console.error('Admin update site error:', error);
    return res.status(500).json({ error: 'Failed to update site' });
  }
});

/**
 * DELETE /api/admin/sites/:siteId
 * Admin force-delete a site and all its pages
 */
router.delete('/:siteId', requireAuth, requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    const { siteId } = req.params;

    const site = await siteBuilderService.getSiteById(siteId);
    if (!site) return res.status(404).json({ error: 'Site not found' });

    // Delete pages first (foreign key)
    await db.execute('DELETE FROM site_pages WHERE site_id = ?', [siteId]);
    await db.execute('DELETE FROM site_deployments WHERE site_id = ?', [siteId]);
    await db.execute('DELETE FROM generated_sites WHERE id = ?', [siteId]);

    return res.json({ success: true, message: `Site "${site.business_name}" deleted` });
  } catch (error) {
    console.error('Admin delete site error:', error);
    return res.status(500).json({ error: 'Failed to delete site' });
  }
});

/**
 * GET /api/admin/sites/trials/active
 * List sites owned by users on active trials
 */
router.get('/trials/active', requireAuth, requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    const rows = await db.query(
      `SELECT gs.id, gs.business_name, gs.status, gs.max_pages, gs.created_at,
              u.email AS owner_email, u.name AS owner_name,
              cp.trial_ends_at, cp.status AS sub_status,
              DATEDIFF(cp.trial_ends_at, NOW()) AS days_left
       FROM generated_sites gs
       JOIN users u ON u.id = gs.user_id
       JOIN user_contact_link ucl ON ucl.user_id = u.id WHERE cp.status = 'TRIAL'
         AND cp.trial_ends_at IS NOT NULL
       ORDER BY cp.trial_ends_at ASC`
    );

    return res.json({ success: true, trials: rows });
  } catch (error) {
    console.error('Admin trials error:', error);
    return res.status(500).json({ error: 'Failed to fetch trials' });
  }
});

export { router as adminSitesRouter };
