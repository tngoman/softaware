/**
 * Cases Routes
 * 
 * Comprehensive case management system for user-reported and auto-detected issues.
 * Includes AI-powered component identification and resolution tracking.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { db, generateId, toMySQLDate } from '../db/mysql.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { analyzeComponentFromContext } from '../services/caseAnalyzer.js';
import { createNotification } from '../services/notificationService.js';
import { safeJson, mapCaseRow } from '../utils/caseMappers.js';

export const casesRouter = Router();

// Configure multer for comment attachments
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'case-attachments');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|pdf|doc|docx|txt|zip)$/i;
    if (allowed.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});


// ─── Validation Schemas ─────────────────────────────────────────────────

const CreateCaseSchema = z.object({
  title: z.string().min(5).max(255),
  description: z.string().optional(),
  category: z.enum(['bug', 'performance', 'ui_issue', 'data_issue', 'security', 'feature_request', 'other']).default('other'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  source: z.enum(['user_report', 'auto_detected', 'health_monitor', 'ai_analysis']).default('user_report'),
  url: z.string().url().optional(),
  page_url: z.string().optional(),
  page_path: z.string().max(500).optional(),
  component_name: z.string().max(255).optional(),
  error_message: z.string().optional(),
  error_stack: z.string().optional(),
  user_agent: z.string().optional(),
  browser_info: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

const UpdateCaseSchema = z.object({
  title: z.string().min(5).max(255).optional(),
  description: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'wont_fix']).optional(),
  assigned_to: z.string().uuid().optional(),
  resolution: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const AddCommentSchema = z.object({
  comment: z.string().min(1),
  is_internal: z.preprocess(
    (val) => val === 'true' || val === true || val === '1',
    z.boolean().default(false)
  ),
  attachments: z.array(z.string().url()).optional(),
});

const RateCaseSchema = z.object({
  rating: z.number().int().min(1).max(5),
  rating_comment: z.string().optional(),
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/cases - Create new case
// ═════════════════════════════════════════════════════════════════════════
casesRouter.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = CreateCaseSchema.parse(req.body);
    const userId = (req as any).userId;
    
    const caseId = generateId();
    const caseNumber = `CASE-${Date.now().toString().slice(-8)}`;
    const now = toMySQLDate(new Date());
    
    // Use AI to analyze component if context provided
    let aiAnalysis = null;
    if (data.page_path || data.component_name || data.url) {
      aiAnalysis = await analyzeComponentFromContext({
        url: data.url,
        page_path: data.page_path,
        component_name: data.component_name,
        description: data.description,
        user_agent: data.user_agent,
      }).catch(err => {
        console.error('[Cases] AI analysis failed:', err);
        return null;
      });
    }
    
    await db.execute(
      `INSERT INTO cases (
        id, case_number, title, description, category, severity, status, type, source,
        reported_by, url, page_path, component_name, error_message, error_stack,
        user_agent, browser_info, ai_analysis, metadata, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId, caseNumber, data.title, data.description || null,
        data.category || 'other', data.severity, 'open', 'user_reported', data.source || 'user_report',
        userId, data.url || data.page_url || null, data.page_path || null,
        data.component_name || null, data.error_message || null, data.error_stack || null,
        data.user_agent || null, JSON.stringify(data.browser_info || {}),
        JSON.stringify(aiAnalysis), JSON.stringify(data.metadata || {}),
        JSON.stringify(data.tags || []), now, now
      ]
    );
    
    // Log activity
    await db.execute(
      'INSERT INTO case_activity (id, case_id, user_id, action, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), caseId, userId, 'created', caseNumber, now]
    );
    
    // Notify admins
    const admins = await db.query<any>(
      `SELECT id FROM users WHERE is_admin = 1`
    );
    
    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: 'case_created',
        title: `New Case: ${data.title}`,
        message: `Case ${caseNumber} was reported — severity: ${data.severity}`,
        data: { caseId, caseNumber, severity: data.severity, action_url: `/cases/${caseId}`, link: `/cases/${caseId}` },
      });
    }
    
    const createdCase = await db.queryOne<any>('SELECT * FROM cases WHERE id = ?', [caseId]);
    
    res.status(201).json({
      success: true,
      case: mapCaseRow(createdCase, aiAnalysis),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    }
    console.error('[Cases] Create error:', err);
    console.error('[Cases] Error stack:', (err as Error).stack);
    console.error('[Cases] Request body:', JSON.stringify(req.body));
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create case',
      message: (err as Error).message,
      details: process.env.NODE_ENV === 'development' ? (err as Error).stack : undefined
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/cases - List user's cases
// ═════════════════════════════════════════════════════════════════════════
casesRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).userId;
    const status = req.query.status as string;
    
    let query = `
      SELECT c.*, COALESCE(u.name, u.email) AS reported_by_name, COALESCE(a.name, a.email) AS assigned_to_name
      FROM cases c
      LEFT JOIN users u ON c.reported_by = u.id
      LEFT JOIN users a ON c.assigned_to = a.id
      WHERE c.reported_by = ?
    `;
    const params: any[] = [userId];
    
    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY c.created_at DESC';
    
    const cases = await db.query<any>(query, params);
    
    res.json({
      success: true,
      cases: cases.map(c => mapCaseRow(c)),
    });
  } catch (err) {
    console.error('[Cases] List error:', err);
    res.status(500).json({ success: false, error: 'Failed to load cases' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/cases/:id - Get case detail
// ═════════════════════════════════════════════════════════════════════════
casesRouter.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).userId;
    const caseId = req.params.id;
    
    const caseData = await db.queryOne<any>(
      `SELECT c.*, COALESCE(u.name, u.email) AS reported_by_name, u.email AS reported_by_email,
              COALESCE(a.name, a.email) AS assigned_to_name, COALESCE(r.name, r.email) AS resolved_by_name
       FROM cases c
       LEFT JOIN users u ON c.reported_by = u.id
       LEFT JOIN users a ON c.assigned_to = a.id
       LEFT JOIN users r ON c.resolved_by = r.id
       WHERE c.id = ?`,
      [caseId]
    );
    
    if (!caseData) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    
    // Check access: reporter or admin
    const adminRow = await db.queryOne<{ is_admin: number }>(
      'SELECT is_admin FROM users WHERE id = ?',
      [userId]
    );
    const isAdmin = adminRow && adminRow.is_admin;
    
    if (caseData.reported_by !== userId && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    // Get comments (exclude internal if not admin)
    let commentsQuery = 'SELECT cc.*, COALESCE(u.name, u.email) AS user_name FROM case_comments cc LEFT JOIN users u ON cc.user_id = u.id WHERE cc.case_id = ?';
    if (!isAdmin) {
      commentsQuery += ' AND cc.is_internal = FALSE';
    }
    commentsQuery += ' ORDER BY cc.created_at ASC';
    
    const comments = await db.query<any>(commentsQuery, [caseId]);
    
    // Get activity log
    const activity = await db.query<any>(
      `SELECT ca.*, COALESCE(u.name, u.email) AS user_name
       FROM case_activity ca
       LEFT JOIN users u ON ca.user_id = u.id
       WHERE ca.case_id = ?
       ORDER BY ca.created_at DESC
       LIMIT 50`,
      [caseId]
    );
    
    res.json({
      success: true,
      case: mapCaseRow(caseData),
      comments: comments.map(c => ({
        ...c,
        attachments: safeJson(c.attachments, []),
      })),
      activity: activity.map(a => ({
        ...a,
        metadata: safeJson(a.metadata, {}),
      })),
    });
  } catch (err) {
    console.error('[Cases] Get detail error:', err);
    res.status(500).json({ success: false, error: 'Failed to load case' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// PATCH /api/cases/:id - Update case
// ═════════════════════════════════════════════════════════════════════════
casesRouter.patch('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = UpdateCaseSchema.parse(req.body);
    const userId = (req as any).userId;
    const caseId = req.params.id;
    
    const existing = await db.queryOne<any>('SELECT * FROM cases WHERE id = ?', [caseId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    
    // Check access: reporter or admin
    const adminRow2 = await db.queryOne<{ is_admin: number }>(
      'SELECT is_admin FROM users WHERE id = ?',
      [userId]
    );
    const isAdmin = adminRow2 && adminRow2.is_admin;
    
    if (existing.reported_by !== userId && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const updates: string[] = [];
    const values: any[] = [];
    const activities: Array<{ action: string; old: any; new: any }> = [];
    
    if (data.title) { updates.push('title = ?'); values.push(data.title); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.severity) {
      updates.push('severity = ?');
      values.push(data.severity);
      activities.push({ action: 'severity_changed', old: existing.severity, new: data.severity });
    }
    if (data.status) {
      updates.push('status = ?');
      values.push(data.status);
      activities.push({ action: 'status_changed', old: existing.status, new: data.status });
      
      if (data.status === 'resolved' || data.status === 'closed') {
        updates.push('resolved_at = ?, resolved_by = ?');
        values.push(toMySQLDate(new Date()), userId);
      }
    }
    if (data.assigned_to) {
      updates.push('assigned_to = ?');
      values.push(data.assigned_to);
      activities.push({ action: 'assigned', old: existing.assigned_to, new: data.assigned_to });
      
      // Notify assignee
      await createNotification({
        userId: data.assigned_to,
        type: 'case_assigned',
        title: `Case Assigned: ${existing.title}`,
        message: `You have been assigned to case ${existing.case_number}`,
        data: { caseId, caseNumber: existing.case_number, action_url: `/cases/${caseId}`, link: `/cases/${caseId}` },
      });
    }
    if (data.resolution) { updates.push('resolution = ?'); values.push(data.resolution); }
    if (data.tags) { updates.push('tags = ?'); values.push(JSON.stringify(data.tags)); }
    
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      values.push(toMySQLDate(new Date()));
      values.push(caseId);
      
      await db.execute(`UPDATE cases SET ${updates.join(', ')} WHERE id = ?`, values);
      
      // Log activities
      const now = toMySQLDate(new Date());
      for (const activity of activities) {
        await db.execute(
          'INSERT INTO case_activity (id, case_id, user_id, action, old_value, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [generateId(), caseId, userId, activity.action, String(activity.old || ''), String(activity.new), now]
        );
      }
      
      // Notify reporter if status changed
      if (data.status && existing.reported_by !== userId) {
        const isResolved = data.status === 'resolved' || data.status === 'closed';
        await createNotification({
          userId: existing.reported_by,
          type: isResolved ? 'case_resolved' : 'case_updated',
          title: isResolved ? `Case Resolved: ${existing.title}` : `Case Updated: ${existing.title}`,
          message: `Your case ${existing.case_number} status changed to ${data.status.replace('_', ' ')}`,
          data: { caseId, caseNumber: existing.case_number, status: data.status, action_url: `/cases/${caseId}`, link: `/cases/${caseId}` },
        });
      }

      // Notify assignee if status changed and they didn't make the change
      if (data.status && existing.assigned_to && existing.assigned_to !== userId) {
        await createNotification({
          userId: existing.assigned_to,
          type: 'case_updated',
          title: `Case Updated: ${existing.title}`,
          message: `Case ${existing.case_number} status changed to ${data.status.replace('_', ' ')}`,
          data: { caseId, caseNumber: existing.case_number, status: data.status, action_url: `/cases/${caseId}`, link: `/cases/${caseId}` },
        });
      }
    }
    
    const updated = await db.queryOne<any>('SELECT * FROM cases WHERE id = ?', [caseId]);
    
    res.json({
      success: true,
      case: mapCaseRow(updated),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    }
    console.error('[Cases] Update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update case' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/cases/:id/comments - Add comment
// ═════════════════════════════════════════════════════════════════════════
casesRouter.post('/:id/comments', requireAuth, upload.array('attachments', 5), async (req: AuthRequest, res: Response) => {
  try {
    const data = AddCommentSchema.parse(req.body);
    const files = req.files as Express.Multer.File[] || [];
    
    // Build attachment URLs from uploaded files
    const attachmentUrls = files.map(f => `/uploads/case-attachments/${f.filename}`);
    const userId = (req as any).userId;
    const caseId = req.params.id;
    
    const caseData = await db.queryOne<any>('SELECT * FROM cases WHERE id = ?', [caseId]);
    if (!caseData) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    
    const commentId = generateId();
    const now = toMySQLDate(new Date());
    
    // Merge uploaded file URLs with any provided attachment URLs
    const allAttachments = [...attachmentUrls, ...(data.attachments || [])];
    
    await db.execute(
      'INSERT INTO case_comments (id, case_id, user_id, comment, is_internal, attachments, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [commentId, caseId, userId, data.comment, data.is_internal, JSON.stringify(allAttachments), now, now]
    );
    
    // Log activity
    await db.execute(
      'INSERT INTO case_activity (id, case_id, user_id, action, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), caseId, userId, 'commented', data.comment.substring(0, 100), now]
    );
    
    // Notify reporter about new comment (unless they wrote it)
    if (!data.is_internal && caseData.reported_by !== userId) {
      await createNotification({
        userId: caseData.reported_by,
        type: 'case_comment',
        title: `New Comment on Case ${caseData.case_number}`,
        message: data.comment.substring(0, 200),
        data: { caseId, caseNumber: caseData.case_number, action_url: `/cases/${caseId}`, link: `/cases/${caseId}` },
      });
    }

    // Notify assignee about new comment (unless they wrote it or it's internal from non-admin)
    if (caseData.assigned_to && caseData.assigned_to !== userId && caseData.assigned_to !== caseData.reported_by) {
      await createNotification({
        userId: caseData.assigned_to,
        type: 'case_comment',
        title: `New Comment on Case ${caseData.case_number}`,
        message: data.comment.substring(0, 200),
        data: { caseId, caseNumber: caseData.case_number, action_url: `/cases/${caseId}`, link: `/cases/${caseId}` },
      });
    }
    
    const comment = await db.queryOne<any>(
      'SELECT cc.*, COALESCE(u.name, u.email) AS user_name FROM case_comments cc LEFT JOIN users u ON cc.user_id = u.id WHERE cc.id = ?',
      [commentId]
    );
    
    res.status(201).json({
      success: true,
      comment: {
        ...comment,
        attachments: safeJson(comment.attachments, []),
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    }
    console.error('[Cases] Add comment error:', err);
    res.status(500).json({ success: false, error: 'Failed to add comment' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/cases/:id/rate - Rate case resolution
// ═════════════════════════════════════════════════════════════════════════
casesRouter.post('/:id/rate', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = RateCaseSchema.parse(req.body);
    const userId = (req as any).userId;
    const caseId = req.params.id;
    
    const caseData = await db.queryOne<any>('SELECT * FROM cases WHERE id = ?', [caseId]);
    if (!caseData) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    
    if (caseData.reported_by !== userId) {
      return res.status(403).json({ success: false, error: 'Only the reporter can rate the case' });
    }
    
    await db.execute(
      'UPDATE cases SET rating = ?, rating_comment = ?, updated_at = ? WHERE id = ?',
      [data.rating, data.rating_comment || null, toMySQLDate(new Date()), caseId]
    );
    
    // Log activity
    await db.execute(
      'INSERT INTO case_activity (id, case_id, user_id, action, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), caseId, userId, 'rated', `${data.rating} stars`, toMySQLDate(new Date())]
    );
    
    res.json({ success: true, message: 'Rating submitted successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: err.errors });
    }
    console.error('[Cases] Rate error:', err);
    res.status(500).json({ success: false, error: 'Failed to rate case' });
  }
});

// ═════════════════════════════════════════════════════════════════════════
// DELETE /api/cases/:id - Delete own case (reporter or admin)
// ═════════════════════════════════════════════════════════════════════════
casesRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).userId;
    const caseId = req.params.id;

    const caseData = await db.queryOne<any>('SELECT * FROM cases WHERE id = ?', [caseId]);
    if (!caseData) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }

    // Allow reporter or admin to delete
    const adminRow = await db.queryOne<{ is_admin: number }>(
      'SELECT is_admin FROM users WHERE id = ?',
      [userId]
    );
    const isAdmin = adminRow && adminRow.is_admin;

    if (caseData.reported_by !== userId && !isAdmin) {
      return res.status(403).json({ success: false, error: 'You can only delete your own cases' });
    }

    // Delete related records first
    await db.execute('DELETE FROM case_comments WHERE case_id = ?', [caseId]);
    await db.execute('DELETE FROM case_activity WHERE case_id = ?', [caseId]);
    await db.execute('DELETE FROM cases WHERE id = ?', [caseId]);

    res.json({ success: true, message: 'Case deleted successfully' });
  } catch (err) {
    console.error('[Cases] Delete error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete case' });
  }
});

export default casesRouter;
