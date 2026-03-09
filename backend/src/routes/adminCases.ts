/**
 * Admin Case Management Routes
 * 
 * Complete admin interface for managing all cases (user-reported and auto-detected).
 * Includes assignment, bulk operations, analytics, and health monitoring.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { db, generateId, toMySQLDate } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getHealthStatus, runHealthChecks } from '../services/healthMonitor.js';
import { createNotification } from '../services/notificationService.js';

export const adminCasesRouter = Router();

/** Safely handle MySQL JSON columns (already parsed objects or JSON strings) */
function safeJson(val: any, fallback: any = null) {
  if (val == null) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

/** Map a raw DB case row to the frontend-expected shape */
function mapCaseRow(row: any) {
  if (!row) return row;
  const source = row.source || (() => {
    switch (row.type) {
      case 'auto_detected': return 'auto_detected';
      case 'monitoring': return 'health_monitor';
      default: return 'user_report';
    }
  })();
  return {
    ...row,
    category: row.category || 'other',
    source,
    user_rating: row.rating ?? null,
    user_feedback: row.rating_comment ?? null,
    page_url: row.url ?? null,
    reporter_name: row.reported_by_name ?? null,
    reporter_email: row.reported_by_email ?? null,
    assignee_name: row.assigned_to_name ?? null,
    ai_analysis: safeJson(row.ai_analysis, null),
    metadata: safeJson(row.metadata, {}),
    tags: safeJson(row.tags, []),
    browser_info: safeJson(row.browser_info, {}),
  };
}
adminCasesRouter.use(requireAuth, requireAdmin);

// ═════════════════════════════════════════════════════════════════════════
// GET /api/admin/cases - List all cases with filters
// ═════════════════════════════════════════════════════════════════════════
adminCasesRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { status, severity, type, assigned_to, search } = req.query;
    
    let query = `
      SELECT c.*, 
             COALESCE(u.name, u.email) AS reported_by_name, u.email AS reported_by_email,
             COALESCE(a.name, a.email) AS assigned_to_name,
             (SELECT COUNT(*) FROM case_comments WHERE case_id = c.id) AS comment_count
      FROM cases c
      LEFT JOIN users u ON c.reported_by = u.id
      LEFT JOIN users a ON c.assigned_to = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }
    if (severity) {
      query += ' AND c.severity = ?';
      params.push(severity);
    }
    if (type) {
      query += ' AND c.type = ?';
      params.push(type);
    }
    if (assigned_to) {
      query += ' AND c.assigned_to = ?';
      params.push(assigned_to);
    }
    if (search) {
      query += ' AND (c.title LIKE ? OR c.description LIKE ? OR c.case_number LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    query += ' ORDER BY c.created_at DESC LIMIT 500';
    
    const cases = await db.query<any>(query, params);
    
    // Get stats
    const stats = await db.queryOne<any>(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN type = 'auto_detected' THEN 1 ELSE 0 END) as auto_detected,
        AVG(rating) as avg_rating
       FROM cases`
    );
    
    res.json({
      success: true,
      cases: cases.map(c => mapCaseRow(c)),
      stats,
    });
  } catch (err) {
    console.error('[AdminCases] List error:', err);
    res.status(500).json({ success: false, error: 'Failed to load cases' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/admin/cases/analytics - Case analytics dashboard
// ═════════════════════════════════════════════════════════════════════════
adminCasesRouter.get('/analytics', async (_req: AuthRequest, res: Response) => {
  try {
    // Core counts
    const totals = await db.queryOne<any>(
      `SELECT 
        COUNT(*) as totalCases,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as openCases,
        SUM(CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 ELSE 0 END) as resolvedCases
       FROM cases`
    );

    // Average resolution time
    const resTime = await db.queryOne<any>(
      `SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_hours
       FROM cases WHERE resolved_at IS NOT NULL`
    );
    const avgHours = resTime?.avg_hours ? Math.round(resTime.avg_hours) : 0;
    const avgResolutionTime = avgHours >= 24 
      ? `${Math.round(avgHours / 24)}d` 
      : `${avgHours}h`;

    // Cases by severity
    const bySeverity = await db.query<any>(
      `SELECT severity, COUNT(*) as count FROM cases GROUP BY severity`
    );

    // Cases by category
    const byCategory = await db.query<any>(
      `SELECT COALESCE(category, 'other') as category, COUNT(*) as count FROM cases GROUP BY category`
    );

    // Cases by status
    const byStatus = await db.query<any>(
      `SELECT status, COUNT(*) as count FROM cases GROUP BY status`
    );

    // Recent trend (last 14 days)
    const recentTrend = await db.query<any>(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM cases
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    res.json({
      success: true,
      totalCases: Number(totals?.totalCases || 0),
      openCases: Number(totals?.openCases || 0),
      resolvedCases: Number(totals?.resolvedCases || 0),
      avgResolutionTime,
      bySeverity: bySeverity || [],
      byCategory: byCategory || [],
      byStatus: byStatus || [],
      recentTrend: recentTrend || [],
    });
  } catch (err) {
    console.error('[AdminCases] Analytics error:', err);
    res.status(500).json({ success: false, error: 'Failed to load analytics' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/admin/cases/bulk-assign - Bulk assign cases
// ═════════════════════════════════════════════════════════════════════════
adminCasesRouter.post('/bulk-assign', async (req: AuthRequest, res: Response) => {
  try {
    const { case_ids, assigned_to } = z.object({
      case_ids: z.array(z.string().uuid()),
      assigned_to: z.string().uuid(),
    }).parse(req.body);
    
    const userId = (req as any).userId;
    const now = toMySQLDate(new Date());

    // Look up assigner name for notification message
    const assigner = await db.queryOne<any>(
      'SELECT COALESCE(name, email) AS name FROM users WHERE id = ?',
      [userId]
    );
    const assignerName = assigner?.name || 'An admin';
    
    for (const caseId of case_ids) {
      await db.execute(
        'UPDATE cases SET assigned_to = ?, updated_at = ? WHERE id = ?',
        [assigned_to, now, caseId]
      );
      
      await db.execute(
        'INSERT INTO case_activity (id, case_id, user_id, action, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), caseId, userId, 'assigned', assigned_to, now]
      );
    }

    // Notify assignee about all assigned cases
    const assignedCases = await db.query<any>(
      `SELECT id, title, case_number FROM cases WHERE id IN (${case_ids.map(() => '?').join(',')})`,
      case_ids
    );
    for (const c of assignedCases) {
      await createNotification({
        userId: assigned_to,
        type: 'case_assigned',
        title: `Case Assigned: ${c.title}`,
        message: `${assignerName} assigned you to case ${c.case_number}`,
        data: { caseId: c.id, caseNumber: c.case_number, action_url: `/cases/${c.id}`, link: `/cases/${c.id}` },
      });
    }
    
    res.json({
      success: true,
      message: `${case_ids.length} cases assigned successfully`,
    });
  } catch (err) {
    console.error('[AdminCases] Bulk assign error:', err);
    res.status(500).json({ success: false, error: 'Failed to assign cases' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/admin/cases/bulk-update-status - Bulk status update
// ═════════════════════════════════════════════════════════════════════════
adminCasesRouter.post('/bulk-update-status', async (req: AuthRequest, res: Response) => {
  try {
    const { case_ids, status } = z.object({
      case_ids: z.array(z.string().uuid()),
      status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'wont_fix']),
    }).parse(req.body);
    
    const userId = (req as any).userId;
    const now = toMySQLDate(new Date());
    
    for (const caseId of case_ids) {
      let updateQuery = 'UPDATE cases SET status = ?, updated_at = ?';
      const updateParams: any[] = [status, now];
      
      if (status === 'resolved' || status === 'closed') {
        updateQuery += ', resolved_at = ?, resolved_by = ?';
        updateParams.push(now, userId);
      }
      
      updateQuery += ' WHERE id = ?';
      updateParams.push(caseId);
      
      await db.execute(updateQuery, updateParams);
      
      await db.execute(
        'INSERT INTO case_activity (id, case_id, user_id, action, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [generateId(), caseId, userId, 'status_changed', status, now]
      );
    }

    // Notify reporters about status changes on their cases
    const updatedCases = await db.query<any>(
      `SELECT id, title, case_number, reported_by, assigned_to FROM cases WHERE id IN (${case_ids.map(() => '?').join(',')})`,
      case_ids
    );
    const isResolved = status === 'resolved' || status === 'closed';
    for (const c of updatedCases) {
      // Notify the reporter
      if (c.reported_by && c.reported_by !== userId) {
        await createNotification({
          userId: c.reported_by,
          type: isResolved ? 'case_resolved' : 'case_updated',
          title: isResolved ? `Case Resolved: ${c.title}` : `Case Updated: ${c.title}`,
          message: `Your case ${c.case_number} status changed to ${status.replace('_', ' ')}`,
          data: { caseId: c.id, caseNumber: c.case_number, status, action_url: `/cases/${c.id}`, link: `/cases/${c.id}` },
        });
      }
      // Notify the assignee (if different from the admin who made the change)
      if (c.assigned_to && c.assigned_to !== userId && c.assigned_to !== c.reported_by) {
        await createNotification({
          userId: c.assigned_to,
          type: 'case_updated',
          title: `Case Updated: ${c.title}`,
          message: `Case ${c.case_number} status changed to ${status.replace('_', ' ')}`,
          data: { caseId: c.id, caseNumber: c.case_number, status, action_url: `/cases/${c.id}`, link: `/cases/${c.id}` },
        });
      }
    }
    
    res.json({
      success: true,
      message: `${case_ids.length} cases updated successfully`,
    });
  } catch (err) {
    console.error('[AdminCases] Bulk status error:', err);
    res.status(500).json({ success: false, error: 'Failed to update cases' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/admin/cases/health - System health status
// ═════════════════════════════════════════════════════════════════════════
adminCasesRouter.get('/health', async (_req: AuthRequest, res: Response) => {
  try {
    const health = await getHealthStatus();
    res.json({ success: true, health });
  } catch (err) {
    console.error('[AdminCases] Health error:', err);
    res.status(500).json({ success: false, error: 'Failed to get health status' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/admin/cases/health/run-checks - Trigger health checks manually
// ═════════════════════════════════════════════════════════════════════════
adminCasesRouter.post('/health/run-checks', async (_req: AuthRequest, res: Response) => {
  try {
    runHealthChecks(); // Fire and forget
    res.json({ success: true, message: 'Health checks triggered' });
  } catch (err) {
    console.error('[AdminCases] Run checks error:', err);
    res.status(500).json({ success: false, error: 'Failed to trigger health checks' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/admin/cases/bulk-delete - Bulk delete cases
// ═════════════════════════════════════════════════════════════════════════
adminCasesRouter.post('/bulk-delete', async (req: AuthRequest, res: Response) => {
  try {
    const { case_ids } = z.object({
      case_ids: z.array(z.string()),
    }).parse(req.body);

    const userId = (req as any).userId;

    // Fetch case data before deletion so we can notify reporters
    const casesToDelete = case_ids.length > 0
      ? await db.query<any>(
          `SELECT id, title, case_number, reported_by FROM cases WHERE id IN (${case_ids.map(() => '?').join(',')})`,
          case_ids
        )
      : [];

    for (const caseId of case_ids) {
      await db.execute('DELETE FROM case_comments WHERE case_id = ?', [caseId]);
      await db.execute('DELETE FROM case_activity WHERE case_id = ?', [caseId]);
      await db.execute('DELETE FROM cases WHERE id = ?', [caseId]);
    }

    // Notify reporters about their deleted cases (fire-and-forget)
    for (const c of casesToDelete) {
      if (c.reported_by && c.reported_by !== userId) {
        createNotification({
          userId: c.reported_by,
          type: 'case_deleted',
          title: `Case Removed: ${c.title}`,
          message: `Your case ${c.case_number} has been removed by an administrator`,
          data: { caseNumber: c.case_number, link: '/cases' },
        }).catch(err => console.error('[AdminCases] Bulk delete notification error:', err));
      }
    }

    res.json({ success: true, message: `${case_ids.length} case(s) deleted` });
  } catch (err) {
    console.error('[AdminCases] Bulk delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete cases' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/cases/:id - Delete a case
// ═════════════════════════════════════════════════════════════════════════
adminCasesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const caseId = req.params.id;
    const userId = (req as any).userId;
    
    const caseData = await db.queryOne<any>('SELECT * FROM cases WHERE id = ?', [caseId]);
    if (!caseData) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    
    // Delete related records (comments, activity) - cascade should handle this but explicit for safety
    await db.execute('DELETE FROM case_comments WHERE case_id = ?', [caseId]);
    await db.execute('DELETE FROM case_activity WHERE case_id = ?', [caseId]);
    await db.execute('DELETE FROM cases WHERE id = ?', [caseId]);

    // Notify reporter their case was deleted (if they didn't delete it)
    if (caseData.reported_by && caseData.reported_by !== userId) {
      await createNotification({
        userId: caseData.reported_by,
        type: 'case_deleted',
        title: `Case Removed: ${caseData.title}`,
        message: `Your case ${caseData.case_number} has been removed by an administrator`,
        data: { caseNumber: caseData.case_number, link: '/cases' },
      });
    }
    
    res.json({ success: true, message: 'Case deleted successfully' });
  } catch (err) {
    console.error('[AdminCases] Delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete case' });
  }
});

export default adminCasesRouter;
