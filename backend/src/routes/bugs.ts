/**
 * Bugs Router
 *
 * Full bug tracking with workflow (Intake → QA → Development → QA to close),
 * comments, attachments, software association, and bidirectional task linking.
 *
 * Routes:
 *   GET    /bugs                         — List bugs (paginated, filterable)
 *   GET    /bugs/stats                   — Bug statistics
 *   GET    /bugs/:id                     — Get a single bug with comments & attachments
 *   POST   /bugs                         — Create a new bug
 *   PUT    /bugs/:id                     — Update a bug
 *   DELETE /bugs/:id                     — Delete a bug
 *
 *   POST   /bugs/:id/comments            — Add a comment
 *   DELETE /bugs/:id/comments/:commentId — Delete a comment
 *
 *   POST   /bugs/:id/attachments         — Upload attachment(s)
 *   DELETE /bugs/:id/attachments/:attId  — Delete an attachment
 *   GET    /bugs/:id/attachments/:attId/download — Download an attachment
 *
 *   PUT    /bugs/:id/workflow            — Advance workflow phase
 *   PUT    /bugs/:id/assign              — Assign bug to a user
 *   PUT    /bugs/:id/link-task           — Link/unlink a task
 *   POST   /bugs/:id/convert-to-task     — Convert bug to a task
 *   POST   /bugs/from-task/:taskId       — Convert a task to a bug
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { requireAuth as strictAuth } from '../middleware/auth.js';
import { db, generateId } from '../db/mysql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { createNotification } from '../services/notificationService.js';
import { sendEmail } from '../services/emailService.js';

// ─── TYPE DEFINITIONS ───────────────────────────────────────────

interface BugRow {
  id: number;
  title: string;
  description: string | null;
  current_behaviour: string | null;
  expected_behaviour: string | null;
  reporter_name: string;
  software_id: number | null;
  software_name: string | null;
  status: string;
  severity: string;
  workflow_phase: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_by: string | null;
  created_by_name: string | null;
  linked_task_id: number | null;
  converted_from_task: boolean;
  converted_to_task: number | null;
  resolution_notes: string | null;
  resolved_at: Date | null;
  resolved_by: string | null;
  created_at: Date;
  updated_at: Date;
}

interface BugComment {
  id: number;
  bug_id: number;
  author_name: string;
  author_id: string | null;
  content: string;
  is_internal: boolean;
  comment_type: string;
  created_at: Date;
  updated_at: Date;
}

interface BugAttachment {
  id: number;
  bug_id: number;
  filename: string;
  original_name: string;
  mime_type: string | null;
  file_size: number | null;
  file_path: string;
  uploaded_by: string | null;
  uploaded_by_id: string | null;
  created_at: Date;
}

interface CountRow {
  total: number;
}

interface GroupCountRow {
  [key: string]: string | number;
  count: number;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
}

export const bugsRouter = Router();

// Optional auth — decodes JWT if present (doesn't block unauthenticated requests)
// Allows external bug reporters while still capturing userId for authenticated staff
// NOTE: Destructive operations (DELETE, download) use strictAuth (imported from middleware/auth.js)
const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const auth = req.header('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded) {
        (req as AuthRequest).userId = String((decoded as any).userId);
      }
    }
  } catch { /* invalid/expired token — proceed without userId */ }
  next();
};

// ─── File upload setup ──────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'bugs');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `bug-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// ─── WORKFLOW CONSTANTS ─────────────────────────────────────────

const WORKFLOW_PHASES = ['intake', 'qa', 'development'] as const;
const VALID_STATUSES  = ['open', 'in-progress', 'pending-qa', 'resolved', 'closed', 'reopened'] as const;
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

// ─── NOTIFICATION HELPERS ────────────────────────────────────────

/** Fetch admin users with the developer role */
async function getAdminUsers(): Promise<AdminUser[]> {
  try {
    const rows = await db.query<AdminUser>(
      `SELECT DISTINCT u.id, u.email, COALESCE(u.name, u.email) AS name
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE u.is_admin = 1 AND r.slug = 'developer' AND u.isActive = 1`
    );
    return rows;
  } catch { return []; }
}

/** True if the string looks like an e-mail address */
function isEmailAddress(str?: string | null): boolean {
  return !!str && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}

/** Fire-and-forget in-app + push notification */
function bugNotify(options: Parameters<typeof createNotification>[0]): void {
  createNotification(options).catch(err => console.error('[Bugs] Notification error:', err));
}

/** Fire-and-forget email */
function bugEmail(options: Parameters<typeof sendEmail>[0]): void {
  sendEmail(options).catch(err => console.error('[Bugs] Email error:', err));
}

// ─── Branded email template ─────────────────────────────────────

const SEVERITY_EMAIL_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA', label: 'Critical' },
  high:     { bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA', label: 'High'     },
  medium:   { bg: '#FEF9C3', text: '#854D0E', border: '#FDE68A', label: 'Medium'   },
  low:      { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0', label: 'Low'      },
};

interface BugEmailBlock {
  label: string;
  value: string;
}

function bugEmailHtml(opts: {
  heading: string;
  preheader?: string;
  severity?: string;
  bugId?: string | number;
  bugTitle?: string;
  blocks?: BugEmailBlock[];
  bodyHtml?: string;
  footerText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const sev = opts.severity ? SEVERITY_EMAIL_COLORS[opts.severity] || SEVERITY_EMAIL_COLORS.medium : null;
  const sevBadge = sev
    ? `<span style="display:inline-block;background:${sev.bg};color:${sev.text};border:1px solid ${sev.border};font-size:12px;font-weight:700;padding:3px 10px;border-radius:12px;margin-left:8px;vertical-align:middle;">${sev.label}</span>`
    : '';
  const bugRef = opts.bugId ? `<span style="color:#9CA3AF;font-size:13px;font-weight:400;"> #${opts.bugId}</span>` : '';

  const rows = (opts.blocks || [])
    .filter(b => b.value)
    .map(b => `
      <tr>
        <td style="padding:8px 12px;font-size:13px;color:#6B7280;font-weight:600;white-space:nowrap;vertical-align:top;border-bottom:1px solid #F3F4F6;">${b.label}</td>
        <td style="padding:8px 12px;font-size:13px;color:#1F2937;border-bottom:1px solid #F3F4F6;">${b.value}</td>
      </tr>`)
    .join('');

  const detailsTable = rows
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;border-collapse:collapse;margin:16px 0;">${rows}</table>`
    : '';

  const ctaButton = opts.ctaLabel && opts.ctaUrl
    ? `<div style="text-align:center;margin:24px 0 8px;">
        <a href="${opts.ctaUrl}" style="display:inline-block;background:#DC2626;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:10px 28px;border-radius:8px;">${opts.ctaLabel}</a>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${opts.preheader}</div>` : ''}
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F3F4F6;padding:24px 0;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#DC2626,#991B1B);padding:28px 32px;border-radius:12px 12px 0 0;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td>
            <span style="font-size:20px;margin-right:8px;">🐛</span>
            <span style="color:#FFFFFF;font-size:20px;font-weight:700;">${opts.heading}</span>
            ${bugRef}
          </td>
        </tr>
        ${opts.bugTitle ? `<tr><td style="padding-top:8px;"><span style="color:#FECACA;font-size:14px;">${opts.bugTitle}</span>${sevBadge}</td></tr>` : ''}
      </table>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="background:#FFFFFF;padding:28px 32px;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
      ${opts.bodyHtml || ''}
      ${detailsTable}
      ${ctaButton}
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#F9FAFB;padding:20px 32px;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;">
      <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
        ${opts.footerText || 'This is an automated notification from SoftAware Bug Tracker.'}
      </p>
      <p style="margin:8px 0 0;font-size:11px;color:#D1D5DB;text-align:center;">
        Soft Aware &copy; ${new Date().getFullYear()}
      </p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════
//  LIST BUGS
// ═══════════════════════════════════════════════════════════════

bugsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (req.query.status) {
      conditions.push('b.status = ?');
      params.push(req.query.status as string);
    }
    if (req.query.severity) {
      conditions.push('b.severity = ?');
      params.push(req.query.severity as string);
    }
    if (req.query.workflow_phase) {
      conditions.push('b.workflow_phase = ?');
      params.push(req.query.workflow_phase as string);
    }
    if (req.query.software_id) {
      conditions.push('b.software_id = ?');
      params.push(req.query.software_id as string);
    }
    if (req.query.assigned_to) {
      conditions.push('b.assigned_to = ?');
      params.push(req.query.assigned_to as string);
    }
    if (req.query.search) {
      conditions.push('(b.title LIKE ? OR b.description LIKE ? OR b.reporter_name LIKE ?)');
      const term = `%${req.query.search}%`;
      params.push(term, term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const [countRow] = await db.query<CountRow>(`SELECT COUNT(*) as total FROM bugs b ${where}`, params);
    const total = countRow?.total || 0;

    // Fetch bugs with comment/attachment counts
    const bugs = await db.query<BugRow & { comment_count: number; attachment_count: number; last_comment: string | null }>(`
      SELECT b.*,
             (SELECT COUNT(*) FROM bug_comments WHERE bug_id = b.id) as comment_count,
             (SELECT COUNT(*) FROM bug_attachments WHERE bug_id = b.id) as attachment_count,
             (SELECT content FROM bug_comments WHERE bug_id = b.id ORDER BY created_at DESC LIMIT 1) as last_comment
      FROM bugs b
      ${where}
      ORDER BY
        FIELD(b.severity, 'critical', 'high', 'medium', 'low'),
        b.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      status: 1,
      message: 'Success',
      data: {
        bugs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          has_next: offset + limit < total,
        },
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  BUG STATISTICS
// ═══════════════════════════════════════════════════════════════

bugsRouter.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const statusCounts = await db.query<GroupCountRow>(`
      SELECT status, COUNT(*) as count FROM bugs GROUP BY status
    `);
    const severityCounts = await db.query<GroupCountRow>(`
      SELECT severity, COUNT(*) as count FROM bugs GROUP BY severity
    `);
    const phaseCounts = await db.query<GroupCountRow>(`
      SELECT workflow_phase, COUNT(*) as count FROM bugs GROUP BY workflow_phase
    `);
    const softwareCounts = await db.query<GroupCountRow>(`
      SELECT software_name, COUNT(*) as count FROM bugs
      WHERE software_id IS NOT NULL GROUP BY software_name
    `);
    const [totalRow] = await db.query<CountRow>('SELECT COUNT(*) as total FROM bugs');

    res.json({
      status: 1,
      data: {
        total: totalRow?.total || 0,
        by_status: Object.fromEntries(statusCounts.map(r => [r.status, r.count])),
        by_severity: Object.fromEntries(severityCounts.map(r => [r.severity, r.count])),
        by_phase: Object.fromEntries(phaseCounts.map(r => [r.workflow_phase, r.count])),
        by_software: Object.fromEntries(softwareCounts.map(r => [r.software_name, r.count])),
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  GET SINGLE BUG (with comments & attachments)
// ═══════════════════════════════════════════════════════════════

bugsRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bug = await db.queryOne<BugRow>('SELECT * FROM bugs WHERE id = ?', [id]);
    if (!bug) return res.status(404).json({ status: 0, message: 'Bug not found' });

    const comments = await db.query<BugComment>(
      'SELECT * FROM bug_comments WHERE bug_id = ? ORDER BY created_at ASC',
      [id]
    );
    const attachments = await db.query<BugAttachment>(
      'SELECT * FROM bug_attachments WHERE bug_id = ? ORDER BY created_at ASC',
      [id]
    );

    // If there's a linked task, fetch basic info
    let linked_task = null;
    if (bug.linked_task_id) {
      linked_task = await db.queryOne<{ id: number; title: string; status: string; workflow_phase: string; external_id: string | null }>(
        'SELECT id, title, status, workflow_phase, external_id FROM local_tasks WHERE id = ?',
        [bug.linked_task_id]
      );
    }

    res.json({
      status: 1,
      data: {
        bug: { ...bug, comments, attachments, linked_task },
      },
    });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  CREATE BUG
// ═══════════════════════════════════════════════════════════════

bugsRouter.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title, description, current_behaviour, expected_behaviour,
      reporter_name, software_id, software_name, severity,
      assigned_to, assigned_to_name, linked_task_id,
    } = req.body;

    if (!title || !reporter_name) {
      return res.status(400).json({ status: 0, message: 'title and reporter_name are required' });
    }

    const bugId = await db.insert(`
      INSERT INTO bugs
        (title, description, current_behaviour, expected_behaviour,
         reporter_name, software_id, software_name, severity,
         assigned_to, assigned_to_name,
         created_by, created_by_name, linked_task_id,
         status, workflow_phase)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 'intake')
    `, [
      title,
      description || null,
      current_behaviour || null,
      expected_behaviour || null,
      reporter_name,
      software_id || null,
      software_name || null,
      severity || 'medium',
      assigned_to || null,
      assigned_to_name || null,
      req.userId || null,
      req.body.created_by_name || reporter_name,
      linked_task_id || null,
    ]);

    // Auto-add a workflow comment
    await db.insert(`
      INSERT INTO bug_comments (bug_id, author_name, author_id, content, comment_type)
      VALUES (?, ?, ?, ?, 'status_change')
    `, [bugId, reporter_name, req.userId || null, `Bug reported and entered Intake phase.`]);

    // ── Notify admins (in-app + push + email) ────────────────────
    const severityLabel = (severity || 'medium').charAt(0).toUpperCase() + (severity || 'medium').slice(1);
    const softwareLabel = software_name ? ` in ${software_name}` : '';
    const admins = await getAdminUsers();
    for (const admin of admins) {
      bugNotify({
        userId: admin.id,
        type: 'bug_created',
        title: `New ${severityLabel} Bug: ${title}`,
        message: `${reporter_name} reported a bug${softwareLabel}`,
        data: { bugId: String(bugId), severity: severity || 'medium', action_url: '/bugs', link: '/bugs' },
      });
      if (admin.email) {
        bugEmail({
          to: admin.email,
          subject: `[Bug #${bugId}] New ${severityLabel} Bug: ${title}`,
          html: bugEmailHtml({
            heading: 'New Bug Report',
            preheader: `${reporter_name} reported a ${severityLabel} bug: ${title}`,
            severity: severity || 'medium',
            bugId,
            bugTitle: title,
            bodyHtml: `<p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;"><strong>${reporter_name}</strong> reported a new bug${softwareLabel}.</p>`,
            blocks: [
              { label: 'Title',              value: title },
              { label: 'Severity',           value: severityLabel },
              ...(software_name ? [{ label: 'Software', value: software_name }] : []),
              ...(description ? [{ label: 'Description', value: description }] : []),
              ...(current_behaviour ? [{ label: 'Current Behaviour', value: current_behaviour }] : []),
              ...(expected_behaviour ? [{ label: 'Expected Behaviour', value: expected_behaviour }] : []),
            ],
            ctaLabel: 'View Bug',
            ctaUrl: `https://app.softaware.net.za/bugs`,
          }),
        });
      }
    }
    // Notify assignee if set at creation
    if (assigned_to) {
      bugNotify({
        userId: assigned_to,
        type: 'bug_assigned',
        title: `Bug Assigned to You: ${title}`,
        message: `Bug #${bugId} has been assigned to you`,
        data: { bugId: String(bugId), action_url: '/bugs', link: '/bugs' },
      });
    }

    const bug = await db.queryOne<BugRow>('SELECT * FROM bugs WHERE id = ?', [bugId]);
    res.status(201).json({ status: 1, message: 'Bug created', data: { bug } });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  UPDATE BUG
// ═══════════════════════════════════════════════════════════════

bugsRouter.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await db.queryOne<BugRow>('SELECT * FROM bugs WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ status: 0, message: 'Bug not found' });

    const allowed = [
      'title', 'description', 'current_behaviour', 'expected_behaviour',
      'reporter_name', 'software_id', 'software_name', 'status', 'severity',
      'assigned_to', 'assigned_to_name', 'resolution_notes',
      'resolved_at', 'resolved_by', 'linked_task_id',
    ];

    const fields: string[] = [];
    const values: (string | number | null | Date)[] = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ status: 0, message: 'No fields to update' });
    }

    values.push(id);
    await db.execute(`UPDATE bugs SET ${fields.join(', ')} WHERE id = ?`, values);

    // ── Notifications for field changes ──────────────────────────
    const statusChanged = req.body.status && req.body.status !== existing.status;
    const assigneeChanged = req.body.assigned_to && req.body.assigned_to !== existing.assigned_to;

    if (statusChanged) {
      const isResolved = req.body.status === 'resolved' || req.body.status === 'closed';
      const statusLabel = String(req.body.status).replace('-', ' ');
      // Notify the bug creator
      if (existing.created_by) {
        bugNotify({
          userId: existing.created_by,
          type: isResolved ? 'bug_resolved' : 'bug_updated',
          title: isResolved ? `Bug Resolved: ${existing.title}` : `Bug Updated: ${existing.title}`,
          message: `Bug #${id} status changed to ${statusLabel}`,
          data: { bugId: String(id), status: req.body.status, action_url: '/bugs', link: '/bugs' },
        });
      }
      // Notify assignee (if different from creator)
      if (existing.assigned_to && Number(existing.assigned_to) !== Number(existing.created_by)) {
        bugNotify({
          userId: existing.assigned_to,
          type: 'bug_updated',
          title: `Bug Updated: ${existing.title}`,
          message: `Bug #${id} status changed to ${statusLabel}`,
          data: { bugId: String(id), status: req.body.status, action_url: '/bugs', link: '/bugs' },
        });
      }
      // Email reporter if reporter_name looks like an email
      if (isEmailAddress(existing.reporter_name)) {
        bugEmail({
          to: existing.reporter_name,
          subject: `[Bug #${id}] Status Changed to ${statusLabel}: ${existing.title}`,
          html: bugEmailHtml({
            heading: 'Bug Status Updated',
            preheader: `Bug #${id} status changed to ${statusLabel}`,
            severity: existing.severity,
            bugId: id,
            bugTitle: existing.title,
            blocks: [
              { label: 'New Status', value: statusLabel },
              ...(req.body.resolution_notes ? [{ label: 'Resolution Notes', value: req.body.resolution_notes }] : []),
            ],
            bodyHtml: `<p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">Your bug report has been updated with a new status.</p>`,
            footerText: 'Thank you for reporting this issue. You will be notified of further updates.',
          }),
        });
      }
    }
    if (assigneeChanged) {
      bugNotify({
        userId: req.body.assigned_to,
        type: 'bug_assigned',
        title: `Bug Assigned to You: ${existing.title}`,
        message: `Bug #${id} has been assigned to you`,
        data: { bugId: String(id), action_url: '/bugs', link: '/bugs' },
      });
    }

    const bug = await db.queryOne<BugRow>('SELECT * FROM bugs WHERE id = ?', [id]);
    res.json({ status: 1, message: 'Bug updated', data: { bug } });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  DELETE BUG
// ═══════════════════════════════════════════════════════════════

bugsRouter.delete('/:id', strictAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bug = await db.queryOne<Pick<BugRow, 'id' | 'title'>>('SELECT id, title FROM bugs WHERE id = ?', [id]);
    if (!bug) return res.status(404).json({ status: 0, message: 'Bug not found' });

    // Delete attachment files from disk
    const attachments = await db.query<BugAttachment>(
      'SELECT file_path FROM bug_attachments WHERE bug_id = ?', [id]
    );
    for (const att of attachments) {
      const fullPath = path.join(__dirname, '..', '..', att.file_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    // CASCADE will remove comments and attachments rows
    await db.execute('DELETE FROM bugs WHERE id = ?', [id]);

    res.json({ status: 1, message: `Bug "${bug.title}" deleted` });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  COMMENTS
// ═══════════════════════════════════════════════════════════════

bugsRouter.post('/:id/comments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const bug = await db.queryOne<BugRow>('SELECT * FROM bugs WHERE id = ?', [id]);
    if (!bug) return res.status(404).json({ status: 0, message: 'Bug not found' });

    const { content, author_name, is_internal, comment_type } = req.body;
    if (!content || !author_name) {
      return res.status(400).json({ status: 0, message: 'content and author_name are required' });
    }

    const commentId = await db.insert(`
      INSERT INTO bug_comments (bug_id, author_name, author_id, content, is_internal, comment_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, author_name, req.userId || null, content, is_internal ? 1 : 0, comment_type || 'comment']);

    // ── Notify on user comments (not system/internal) ────────────
    const isUserComment = (!comment_type || comment_type === 'comment') && !is_internal;
    if (isUserComment) {
      const snippet = String(content).substring(0, 200);
      // Notify bug creator
      if (bug.created_by && bug.created_by !== (req as AuthRequest).userId) {
        bugNotify({
          userId: bug.created_by,
          type: 'bug_comment',
          title: `New Comment on Bug #${id}: ${bug.title}`,
          message: `${author_name}: ${snippet}`,
          data: { bugId: String(id), action_url: '/bugs', link: '/bugs' },
        });
      }
      // Notify assignee (if different from creator)
      if (bug.assigned_to && Number(bug.assigned_to) !== Number(bug.created_by) && Number(bug.assigned_to) !== Number((req as AuthRequest).userId)) {
        bugNotify({
          userId: bug.assigned_to,
          type: 'bug_comment',
          title: `New Comment on Bug #${id}: ${bug.title}`,
          message: `${author_name}: ${snippet}`,
          data: { bugId: String(id), action_url: '/bugs', link: '/bugs' },
        });
      }
      // Email reporter if reporter_name looks like an email
      if (isEmailAddress(bug.reporter_name)) {
        bugEmail({
          to: bug.reporter_name,
          subject: `[Bug #${id}] New Comment: ${bug.title}`,
          html: bugEmailHtml({
            heading: 'New Comment',
            preheader: `${author_name} commented on Bug #${id}: ${bug.title}`,
            severity: bug.severity,
            bugId: id,
            bugTitle: bug.title,
            bodyHtml: `<p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">A new comment has been added to your bug report.</p>
                       <div style="background:#F9FAFB;border-left:4px solid #DC2626;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 16px;">
                         <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6B7280;">${author_name}</p>
                         <p style="margin:0;font-size:14px;color:#1F2937;line-height:1.5;">${snippet}</p>
                       </div>`,
            ctaLabel: 'View Conversation',
            ctaUrl: `https://app.softaware.net.za/bugs`,
          }),
        });
      }
    }

    const comment = await db.queryOne<BugComment>('SELECT * FROM bug_comments WHERE id = ?', [commentId]);
    res.status(201).json({ status: 1, message: 'Comment added', data: { comment } });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

bugsRouter.delete('/:id/comments/:commentId', strictAuth, async (req: Request, res: Response) => {
  try {
    const { id, commentId } = req.params;
    const comment = await db.queryOne<Pick<BugComment, 'id'>>(
      'SELECT id FROM bug_comments WHERE id = ? AND bug_id = ?', [commentId, id]
    );
    if (!comment) return res.status(404).json({ status: 0, message: 'Comment not found' });

    await db.execute('DELETE FROM bug_comments WHERE id = ?', [commentId]);
    res.json({ status: 1, message: 'Comment deleted' });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  ATTACHMENTS
// ═══════════════════════════════════════════════════════════════

bugsRouter.post('/:id/attachments', requireAuth, upload.array('files', 10), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const bug = await db.queryOne<Pick<BugRow, 'id'>>('SELECT id FROM bugs WHERE id = ?', [id]);
    if (!bug) return res.status(404).json({ status: 0, message: 'Bug not found' });

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ status: 0, message: 'No files provided' });
    }

    const inserted: BugAttachment[] = [];
    for (const file of files) {
      const relPath = `uploads/bugs/${file.filename}`;
      const attId = await db.insert(`
        INSERT INTO bug_attachments (bug_id, filename, original_name, mime_type, file_size, file_path, uploaded_by, uploaded_by_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, file.filename, file.originalname, file.mimetype, file.size, relPath, req.body.uploaded_by || null, req.userId || null]);

      const att = await db.queryOne<BugAttachment>('SELECT * FROM bug_attachments WHERE id = ?', [attId]);
      inserted.push(att);
    }

    res.status(201).json({ status: 1, message: `${inserted.length} attachment(s) uploaded`, data: { attachments: inserted } });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

bugsRouter.delete('/:id/attachments/:attId', strictAuth, async (req: Request, res: Response) => {
  try {
    const { id, attId } = req.params;
    const att = await db.queryOne<BugAttachment>(
      'SELECT * FROM bug_attachments WHERE id = ? AND bug_id = ?', [attId, id]
    );
    if (!att) return res.status(404).json({ status: 0, message: 'Attachment not found' });

    // Delete file from disk
    const fullPath = path.join(__dirname, '..', '..', att.file_path);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

    await db.execute('DELETE FROM bug_attachments WHERE id = ?', [attId]);
    res.json({ status: 1, message: 'Attachment deleted' });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

bugsRouter.get('/:id/attachments/:attId/download', strictAuth, async (req: Request, res: Response) => {
  try {
    const { id, attId } = req.params;
    const att = await db.queryOne<BugAttachment>(
      'SELECT * FROM bug_attachments WHERE id = ? AND bug_id = ?', [attId, id]
    );
    if (!att) return res.status(404).json({ status: 0, message: 'Attachment not found' });

    const fullPath = path.join(__dirname, '..', '..', att.file_path);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ status: 0, message: 'File not found on disk' });
    }

    res.download(fullPath, att.original_name);
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  WORKFLOW — Advance phase
// ═══════════════════════════════════════════════════════════════

bugsRouter.put('/:id/workflow', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { workflow_phase, user_name } = req.body;

    if (!workflow_phase || !WORKFLOW_PHASES.includes(workflow_phase as any)) {
      return res.status(400).json({
        status: 0,
        message: `Invalid phase. Valid phases: ${WORKFLOW_PHASES.join(', ')}`,
      });
    }

    const bug = await db.queryOne<BugRow>('SELECT * FROM bugs WHERE id = ?', [id]);
    if (!bug) return res.status(404).json({ status: 0, message: 'Bug not found' });

    const oldPhase = bug.workflow_phase;

    const resolvedFields = '';
    const resolvedParams: string[] = [];

    await db.execute(`
      UPDATE bugs SET workflow_phase = ? ${resolvedFields} WHERE id = ?
    `, [workflow_phase, ...resolvedParams, id]);

    // Log workflow change as a comment
    await db.insert(`
      INSERT INTO bug_comments (bug_id, author_name, author_id, content, comment_type)
      VALUES (?, ?, ?, ?, 'workflow_change')
    `, [
      id,
      user_name || 'System',
      req.userId || null,
      `Workflow phase changed: ${oldPhase} \u2192 ${workflow_phase}`,
    ]);

    // ── Notify bug creator + assignee of phase change ────────────
    const phaseLabel = workflow_phase.charAt(0).toUpperCase() + workflow_phase.slice(1);
    if (bug.created_by) {
      bugNotify({
        userId: bug.created_by,
        type: 'bug_workflow',
        title: `Bug Phase Changed: ${bug.title}`,
        message: `Bug #${id} moved to ${phaseLabel} phase`,
        data: { bugId: String(id), phase: workflow_phase, action_url: '/bugs', link: '/bugs' },
      });
    }
    if (bug.assigned_to && Number(bug.assigned_to) !== Number(bug.created_by)) {
      bugNotify({
        userId: bug.assigned_to,
        type: 'bug_workflow',
        title: `Bug Phase Changed: ${bug.title}`,
        message: `Bug #${id} moved to ${phaseLabel} phase`,
        data: { bugId: String(id), phase: workflow_phase, action_url: '/bugs', link: '/bugs' },
      });
    }
    // Email reporter if reporter_name looks like an email
    if (isEmailAddress(bug.reporter_name)) {
      bugEmail({
        to: bug.reporter_name,
        subject: `[Bug #${id}] Now in ${phaseLabel} Phase: ${bug.title}`,
        html: bugEmailHtml({
          heading: 'Workflow Phase Updated',
          preheader: `Bug #${id} moved to ${phaseLabel} phase`,
          severity: bug.severity,
          bugId: id,
          bugTitle: bug.title,
          blocks: [
            { label: 'New Phase', value: phaseLabel },
            ...(oldPhase ? [{ label: 'Previous Phase', value: oldPhase.charAt(0).toUpperCase() + oldPhase.slice(1) }] : []),
          ],
          bodyHtml: `<p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">Your bug report has progressed to a new workflow phase. The team is actively working on it.</p>`,
          footerText: 'You will be notified of further updates to this bug report.',
        }),
      });
    }

    const updated = await db.queryOne<BugRow>('SELECT * FROM bugs WHERE id = ?', [id]);
    res.json({ status: 1, message: 'Workflow updated', data: { bug: updated } });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  ASSIGN
// ═══════════════════════════════════════════════════════════════

bugsRouter.put('/:id/assign', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { assigned_to, assigned_to_name } = req.body;

    const bug = await db.queryOne<BugRow>('SELECT * FROM bugs WHERE id = ?', [id]);
    if (!bug) return res.status(404).json({ status: 0, message: 'Bug not found' });

    await db.execute(
      'UPDATE bugs SET assigned_to = ?, assigned_to_name = ? WHERE id = ?',
      [assigned_to || null, assigned_to_name || null, id]
    );

    // Log assignment as comment
    const assignMsg = assigned_to_name
      ? `Bug assigned to ${assigned_to_name}`
      : 'Bug unassigned';
    await db.insert(`
      INSERT INTO bug_comments (bug_id, author_name, author_id, content, comment_type)
      VALUES (?, ?, ?, ?, 'status_change')
    `, [id, req.body.user_name || 'System', req.userId || null, assignMsg]);

    // ── Notify new assignee ───────────────────────────────────────
    if (assigned_to && assigned_to !== bug.assigned_to) {
      bugNotify({
        userId: assigned_to,
        type: 'bug_assigned',
        title: `Bug Assigned to You: ${bug.title}`,
        message: `Bug #${id} has been assigned to you`,
        data: { bugId: String(id), action_url: '/bugs', link: '/bugs' },
      });
    }

    const updated = await db.queryOne<BugRow>('SELECT * FROM bugs WHERE id = ?', [id]);
    res.json({ status: 1, message: 'Assignment updated', data: { bug: updated } });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  LINK / UNLINK TASK
// ═══════════════════════════════════════════════════════════════

bugsRouter.put('/:id/link-task', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { linked_task_id } = req.body;

    const bug = await db.queryOne<Pick<BugRow, 'id'>>('SELECT id FROM bugs WHERE id = ?', [id]);
    if (!bug) return res.status(404).json({ status: 0, message: 'Bug not found' });

    // Validate task exists if linking
    if (linked_task_id) {
      const task = await db.queryOne<{ id: number }>('SELECT id FROM local_tasks WHERE id = ?', [linked_task_id]);
      if (!task) return res.status(404).json({ status: 0, message: 'Task not found' });
    }

    await db.execute('UPDATE bugs SET linked_task_id = ? WHERE id = ?', [linked_task_id || null, id]);

    const updated = await db.queryOne<BugRow>('SELECT * FROM bugs WHERE id = ?', [id]);
    res.json({ status: 1, message: linked_task_id ? 'Task linked' : 'Task unlinked', data: { bug: updated } });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  CONVERT BUG → TASK
// ═══════════════════════════════════════════════════════════════

bugsRouter.post('/:id/convert-to-task', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const bug = await db.queryOne<BugRow>('SELECT * FROM bugs WHERE id = ?', [id]);
    if (!bug) return res.status(404).json({ status: 0, message: 'Bug not found' });

    if (bug.converted_to_task) {
      return res.status(409).json({ status: 0, message: 'Bug already converted to a task', data: { task_id: bug.converted_to_task } });
    }

    // We need a source to create a local task — use the first available source for the software,
    // or fall back to any source
    let source: { id: number } | null = null;
    if (bug.software_id) {
      source = await db.queryOne<{ id: number }>(
        'SELECT id FROM task_sources WHERE software_id = ? LIMIT 1', [bug.software_id]
      );
    }
    if (!source) {
      source = await db.queryOne<{ id: number }>('SELECT id FROM task_sources ORDER BY id LIMIT 1');
    }

    if (!source) {
      return res.status(400).json({ status: 0, message: 'No task source available. Register a task source first.' });
    }

    // Create local task from bug data
    const description = [
      bug.description ? `<p><strong>Description:</strong></p>${bug.description}` : '',
      bug.current_behaviour ? `<p><strong>Current Behaviour:</strong></p><p>${bug.current_behaviour}</p>` : '',
      bug.expected_behaviour ? `<p><strong>Expected Behaviour:</strong></p><p>${bug.expected_behaviour}</p>` : '',
      `<p><em>Converted from Bug #${bug.id} — reported by ${bug.reporter_name}</em></p>`,
    ].filter(Boolean).join('\n');

    const externalId = `bug-${bug.id}-${Date.now()}`;
    const taskId = await db.insert(`
      INSERT INTO local_tasks
        (source_id, external_id, title, description, status, type,
         software_id, assigned_to, assigned_to_name, created_by_name,
         workflow_phase, local_dirty)
      VALUES (?, ?, ?, ?, 'new', 'bug-fix', ?, ?, ?, ?, 'intake', 1)
    `, [
      source.id,
      externalId,
      `[Bug #${bug.id}] ${bug.title}`,
      description,
      bug.software_id || null,
      bug.assigned_to || null,
      bug.assigned_to_name || null,
      bug.reporter_name,
      ]);

    // Update bug with the converted task reference
    await db.execute(
      'UPDATE bugs SET converted_to_task = ?, linked_task_id = ? WHERE id = ?',
      [taskId, taskId, id]
    );

    // Add conversion comment
    await db.insert(`
      INSERT INTO bug_comments (bug_id, author_name, author_id, content, comment_type)
      VALUES (?, ?, ?, ?, 'status_change')
    `, [id, req.body.user_name || 'System', req.userId || null, `Bug converted to Task #${taskId}`]);

    const task = await db.queryOne<Record<string, unknown>>('SELECT * FROM local_tasks WHERE id = ?', [taskId]);
    res.status(201).json({ status: 1, message: 'Bug converted to task', data: { task, bug_id: id } });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ═══════════════════════════════════════════════════════════════
//  CONVERT TASK → BUG
// ═══════════════════════════════════════════════════════════════

bugsRouter.post('/from-task/:taskId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = await db.queryOne<Record<string, unknown>>('SELECT * FROM local_tasks WHERE id = ?', [taskId]);
    if (!task) return res.status(404).json({ status: 0, message: 'Task not found' });

    const {
      reporter_name, current_behaviour, expected_behaviour,
      severity, software_name,
    } = req.body;

    const bugId = await db.insert(`
      INSERT INTO bugs
        (title, description, current_behaviour, expected_behaviour,
         reporter_name, software_id, software_name, severity,
         assigned_to, assigned_to_name,
         created_by, created_by_name,
         linked_task_id, converted_from_task,
         status, workflow_phase)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'open', 'intake')
    `, [
      String(task.title).replace(/^\[Bug #\d+\]\s*/, ''),  // Strip any existing bug prefix
      task.description || null,
      current_behaviour || null,
      expected_behaviour || null,
      reporter_name || task.created_by_name || 'Unknown',
      task.software_id || null,
      software_name || null,
      severity || 'medium',
      task.assigned_to || null,
      task.assigned_to_name || null,
      req.userId || null,
      req.body.created_by_name || task.created_by_name || 'System',
      taskId,
    ]);

    // Auto-add workflow comment
    await db.insert(`
      INSERT INTO bug_comments (bug_id, author_name, author_id, content, comment_type)
      VALUES (?, ?, ?, ?, 'status_change')
    `, [bugId, reporter_name || 'System', req.userId || null, `Bug created from Task #${taskId}`]);

    const bug = await db.queryOne<BugRow>('SELECT * FROM bugs WHERE id = ?', [bugId]);
    res.status(201).json({ status: 1, message: 'Task converted to bug', data: { bug, task_id: taskId } });
  } catch (err: unknown) {
    res.status(500).json({ status: 0, message: err instanceof Error ? err.message : 'Unknown error' });
  }
});

export default bugsRouter;
