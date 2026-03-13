/**
 * adminAuditLog.ts — API routes for viewing and managing the admin audit log.
 *
 * All routes are admin-only (requireAuth + requireAdmin applied at mount level).
 *
 * Endpoints:
 *   GET    /admin/audit-log              — Paginated, filterable log list
 *   GET    /admin/audit-log/stats        — Dashboard statistics
 *   GET    /admin/audit-log/filters      — Available filter values (resource types, users)
 *   POST   /admin/audit-log/trim         — Trim entries older than N days
 *   DELETE /admin/audit-log/bulk         — Delete specific entries by ID
 *   DELETE /admin/audit-log/purge        — Purge ALL entries (danger zone)
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { auditLog } from '../db/auditLog.js';

export const adminAuditLogRouter = Router();

adminAuditLogRouter.use(requireAuth, requireAdmin);

// ─── GET /admin/audit-log — Paginated log list ──────────────────────────

adminAuditLogRouter.get('/', async (req, res, next) => {
  try {
    const params = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      user_id: req.query.user_id as string | undefined,
      action: req.query.action as string | undefined,
      resource_type: req.query.resource_type as string | undefined,
      search: req.query.search as string | undefined,
      from_date: req.query.from_date as string | undefined,
      to_date: req.query.to_date as string | undefined,
      status_min: req.query.status_min ? parseInt(req.query.status_min as string, 10) : undefined,
      status_max: req.query.status_max ? parseInt(req.query.status_max as string, 10) : undefined,
    };

    const result = auditLog.query(params);

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/audit-log/stats — Dashboard statistics ──────────────────

adminAuditLogRouter.get('/stats', async (_req, res, next) => {
  try {
    const stats = auditLog.stats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /admin/audit-log/filters — Available filter values ──────────────

adminAuditLogRouter.get('/filters', async (_req, res, next) => {
  try {
    const resourceTypes = auditLog.resourceTypes();
    const users = auditLog.users();
    const actions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

    res.json({
      success: true,
      data: {
        resource_types: resourceTypes,
        users,
        actions,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /admin/audit-log/trim — Trim old entries ──────────────────────

const trimSchema = z.object({
  days: z.number().int().min(1).max(3650),
});

adminAuditLogRouter.post('/trim', async (req, res, next) => {
  try {
    const { days } = trimSchema.parse(req.body);
    const deleted = auditLog.trim(days);

    res.json({
      success: true,
      message: `Deleted ${deleted} log entries older than ${days} days`,
      deleted,
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /admin/audit-log/bulk — Delete specific entries ──────────────

const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(1000),
});

adminAuditLogRouter.delete('/bulk', async (req, res, next) => {
  try {
    const { ids } = bulkDeleteSchema.parse(req.body);
    const deleted = auditLog.deleteByIds(ids);

    res.json({
      success: true,
      message: `Deleted ${deleted} log entries`,
      deleted,
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /admin/audit-log/purge — Purge ALL entries ───────────────────

adminAuditLogRouter.delete('/purge', async (req, res, next) => {
  try {
    // Require explicit confirmation
    const confirm = req.query.confirm;
    if (confirm !== 'yes') {
      res.status(400).json({
        success: false,
        error: 'Must pass ?confirm=yes to purge all audit log entries',
      });
      return;
    }

    const deleted = auditLog.purgeAll();

    res.json({
      success: true,
      message: `Purged all ${deleted} log entries`,
      deleted,
    });
  } catch (err) {
    next(err);
  }
});
