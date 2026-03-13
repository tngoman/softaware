/**
 * Softaware Tasks — Proxy Router (API-Key Auth)
 *
 * Proxies task requests to external software APIs using source-level API keys
 * from the task_sources table. No per-user/per-software authentication required.
 *
 * Auth is resolved via `resolveTaskSource()` which looks up the task_sources
 * table by software_id or apiUrl to find the base_url + api_key to use.
 *
 * All external tasks-api endpoints from TASKS_API.md are supported.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { db } from '../db/mysql.js';
import { createNotificationWithPush } from '../services/firebaseService.js';

export const softawareTasksRouter = Router();

// No-op auth — local-only tool, no login required
const requireAuth = (_req: Request, _res: Response, next: NextFunction) => next();

/**
 * Forward a request to the external tasks-api using source-level API key auth.
 */
async function proxyToExternal(
  baseUrl: string,
  path: string,
  method: string,
  apiKey: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-Key': apiKey,
  };

  const opts: RequestInit = {
    method,
    headers,
  };
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body);
  }

  const resp = await fetch(url, opts);
  const contentType = resp.headers.get('content-type') || '';

  let data: any;
  if (contentType.includes('application/json')) {
    data = await resp.json();
  } else {
    data = await resp.text();
  }
  return { status: resp.status, data };
}

async function resolveTaskSource(req: Request): Promise<{ baseUrl: string; apiKey: string; sourceId: number | null }> {
  const rawApiUrl = (req.query.apiUrl as string) || (req.body?.apiUrl as string) || '';
  const normalizedApiUrl = rawApiUrl ? rawApiUrl.replace(/\/+$/, '') : '';
  const softwareId = Number(req.query.software_id || req.body?.software_id || req.body?.task?.software_id || 0) || null;

  let source: any = null;

  if (softwareId) {
    source = await db.queryOne<any>(
      `SELECT id, base_url, api_key
       FROM task_sources
       WHERE software_id = ? AND sync_enabled = 1
       ORDER BY id ASC
       LIMIT 1`,
      [softwareId]
    );
  }

  if (!source && normalizedApiUrl) {
    source = await db.queryOne<any>(
      `SELECT id, base_url, api_key
       FROM task_sources
       WHERE TRIM(TRAILING '/' FROM base_url) = TRIM(TRAILING '/' FROM ?)
       ORDER BY id ASC
       LIMIT 1`,
      [normalizedApiUrl]
    );
  }

  if (!source && normalizedApiUrl) {
    const baseOrigin = (() => {
      try {
        return new URL(normalizedApiUrl).origin;
      } catch {
        return '';
      }
    })();
    if (baseOrigin) {
      source = await db.queryOne<any>(
        `SELECT id, base_url, api_key
         FROM task_sources
         WHERE base_url LIKE ?
         ORDER BY id ASC
         LIMIT 1`,
        [`${baseOrigin}%`]
      );
    }
  }

  if (!source) {
    throw new Error('No task source configured for this software/apiUrl');
  }
  if (!source.api_key) {
    throw new Error(`Task source #${source.id} has no API key configured`);
  }

  return {
    baseUrl: String(source.base_url || '').replace(/\/+$/, ''),
    apiKey: String(source.api_key),
    sourceId: source.id ?? null,
  };
}

/**
 * Send task assignment notification to the assigned user
 * Looks up the user by ID and sends both in-app and push notification
 */
async function sendTaskAssignmentNotification(task: any, assignerUserId: string | undefined): Promise<void> {
  const assignedUserId = String(task.assigned_to);
  
  // Find the assigned user in our local system users
  const assignedUser = await db.queryOne<any>(
    'SELECT id, name, email FROM users WHERE id = ?',
    [assignedUserId]
  );
  
  if (!assignedUser) {
    console.log(`[Task Assignment] User ${assignedUserId} not found in local system — skipping notification`);
    return;
  }
  
  // Don't notify if the user assigned the task to themselves
  if (assignerUserId && assignedUserId === assignerUserId) {
    return;
  }

  // Get assigner name if available
  let assignerName = 'Someone';
  if (assignerUserId) {
    const assigner = await db.queryOne<any>('SELECT name, email FROM users WHERE id = ?', [assignerUserId]);
    if (assigner) {
      assignerName = assigner.name || assigner.email || 'Someone';
    }
  }
  
  const taskTitle = task.title || `Task #${task.id}`;
  const phase = task.workflow_phase ? ` (${task.workflow_phase})` : '';
  
  await createNotificationWithPush(assignedUser.id, {
    title: 'Task Assigned to You',
    message: `${assignerName} assigned you: ${taskTitle}${phase}`,
    type: 'info',
    data: {
      type: 'task_assigned',
      task_id: String(task.id),
      workflow_phase: task.workflow_phase || '',
      link: '/tasks',
    },
  });
}

/**
 * Send task workflow phase change notification to the assigned user
 * Only fires when the workflow_phase changes and the user making the change
 * is not the assigned user.
 */
async function sendTaskPhaseChangeNotification(task: any, changerUserId: string | undefined): Promise<void> {
  if (!task.assigned_to || !task.workflow_phase) return;

  const assignedUserId = String(task.assigned_to);
  // Don't notify if the assigned user changed the phase themselves
  if (changerUserId && assignedUserId === changerUserId) return;

  const assignedUser = await db.queryOne<any>(
    'SELECT id, name, email FROM users WHERE id = ?',
    [assignedUserId]
  );
  if (!assignedUser) return;

  let changerName = 'Someone';
  if (changerUserId) {
    const changer = await db.queryOne<any>('SELECT name, email FROM users WHERE id = ?', [changerUserId]);
    if (changer) changerName = changer.name || changer.email || 'Someone';
  }

  const taskTitle = task.title || `Task #${task.id}`;

  await createNotificationWithPush(assignedUser.id, {
    title: 'Task Phase Updated',
    message: `${changerName} moved "${taskTitle}" to ${task.workflow_phase}`,
    type: 'info',
    data: {
      type: 'task_phase_changed',
      task_id: String(task.id),
      workflow_phase: task.workflow_phase,
      link: '/tasks',
    },
  });
}

// ─── GET /softaware/tasks ──────────────────────────────────────
softawareTasksRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const page = req.query.page || 1;
    const limit = req.query.limit || 1000;

    const result = await proxyToExternal(
      baseUrl,
      `/api/tasks-api?page=${page}&limit=${limit}`,
      'GET',
      apiKey
    );
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks ─────────────────────────────────────
softawareTasksRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { task } = req.body;

    const result = await proxyToExternal(baseUrl, '/api/tasks-api', 'POST', apiKey, task);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * Convert a decimal hours value (e.g. "2.50", 2.5) to HH:MM string.
 * Also accepts HH:MM pass-through if already in that format.
 */
function toHHMM(val: any): string {
  if (val == null || val === '') return '00:00';
  const s = String(val).trim();
  // Already HH:MM format
  if (/^\d+:\d{2}$/.test(s)) return s;
  const num = parseFloat(s);
  if (isNaN(num)) return '00:00';
  const h = Math.floor(Math.abs(num));
  const m = Math.round((Math.abs(num) - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── PUT /softaware/tasks ──────────────────────────────────────
softawareTasksRouter.put('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { task } = req.body;
    const taskId = task?.task_id || task?.id;
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'task_id (or id) is required' });
    }

    const updatePayload = { ...task };
    delete updatePayload.task_id;
    delete updatePayload.id;

    // ── Handle hours separately via the dedicated hours endpoint ──
    // The generic PUT ignores task_hours; must use PUT /{id}/hours
    const rawHours = updatePayload.task_hours ?? updatePayload.hours;
    delete updatePayload.task_hours;
    delete updatePayload.hours;

    if (rawHours != null && rawHours !== '') {
      const hhmm = toHHMM(rawHours);
      // Fire hours update in parallel (don't block the main update)
      proxyToExternal(baseUrl, `/api/tasks-api/${taskId}/hours`, 'PUT', apiKey, { hours: hhmm }).catch(err => {
        console.error(`[Task Update] Hours update failed for task ${taskId}:`, err);
      });
    }

    // ── Normalise empty-string date fields to null so the API clears them ──
    for (const field of ['actual_start', 'actual_end', 'task_start', 'task_end']) {
      if (updatePayload[field] === '') {
        updatePayload[field] = null;
      }
    }

    // Update the task on the external API
    const result = await proxyToExternal(baseUrl, `/api/tasks-api/${taskId}`, 'PUT', apiKey, updatePayload);
    
    // If successful, send relevant notifications (fire & forget — don't block response)
    if (result.status >= 200 && result.status < 300) {
      // Assignment notification
      if (task?.assigned_to) {
        sendTaskAssignmentNotification(task, req.userId).catch(err => {
          console.error('[Task Assignment] Notification failed:', err);
        });
      }
      // Workflow phase change notification (to assigned user, if someone else changed it)
      if (task?.workflow_phase && task?.assigned_to) {
        sendTaskPhaseChangeNotification(task, req.userId).catch(err => {
          console.error('[Task Phase Change] Notification failed:', err);
        });
      }
    }
    
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── DELETE /softaware/tasks/:id ───────────────────────────────
softawareTasksRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey, sourceId } = await resolveTaskSource(req);
    const { id } = req.params;

    const result = await proxyToExternal(baseUrl, `/api/tasks-api/${id}`, 'DELETE', apiKey);

    // Also soft-delete in local cache so the task disappears immediately
    if (result.status >= 200 && result.status < 300) {
      try {
        await db.execute(
          'UPDATE local_tasks SET task_deleted = 1, updated_at = NOW() WHERE external_id = ? AND task_deleted = 0',
          [String(id)]
        );
      } catch (localErr) {
        console.error('[Task Delete] Local soft-delete failed:', localErr);
      }
    }

    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks/reorder ─────────────────────────────
softawareTasksRouter.post('/reorder', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { orders } = req.body;

    const result = await proxyToExternal(baseUrl, '/api/tasks-api/reorder', 'POST', apiKey, { orders });
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/:id/associations ─────────────────────
softawareTasksRouter.get('/:id/associations', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id } = req.params;

    const result = await proxyToExternal(baseUrl, `/api/tasks-api/${id}/associated`, 'GET', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks/:id/associations ────────────────────
softawareTasksRouter.post('/:id/associations', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id } = req.params;
    const { parent_task_id, association_type, notes } = req.body;

    const result = await proxyToExternal(baseUrl, `/api/tasks-api/${id}/associate`, 'POST', apiKey, {
      parent_task_id,
      association_type,
      notes,
    });
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── DELETE /softaware/tasks/:id/associations ──────────────────
softawareTasksRouter.delete('/:id/associations', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id } = req.params;

    const result = await proxyToExternal(baseUrl, `/api/tasks-api/${id}/associate`, 'DELETE', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/:id/attachments ──────────────────────
softawareTasksRouter.get('/:id/attachments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id } = req.params;

    const result = await proxyToExternal(baseUrl, `/api/tasks-api/${id}/attachments`, 'GET', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks/:id/attachments ─────────────────────
// Accepts { files: [{ base64, fileName, mimeType }], comment_id? }
softawareTasksRouter.post('/:id/attachments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id } = req.params;
    const { files, comment_id } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error('files array is required');
    }

    const results: any[] = [];
    for (const file of files) {
      const base64Data = file.base64.replace(/^data:[^;]+;base64,/, '');
      const fileBuffer = Buffer.from(base64Data, 'base64');
      const safeName = file.fileName || 'upload.png';
      const mimeType = file.mimeType || 'application/octet-stream';

      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: mimeType });
      formData.append('file', blob, safeName);
      if (comment_id) formData.append('comment_id', String(comment_id));

      const uploadUrl = `${baseUrl.replace(/\/+$/, '')}/api/tasks-api/${id}/attachments`;
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'X-API-Key': apiKey,
      };

      const resp = await fetch(uploadUrl, { method: 'POST', headers, body: formData });
      const ct = resp.headers.get('content-type') || '';
      const data = ct.includes('json') ? await resp.json() : await resp.text();
      results.push(data);
    }

    res.json({ success: true, attachments: results });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── DELETE /softaware/tasks/:id/attachments/:attachmentId ─────
softawareTasksRouter.delete('/:id/attachments/:attachmentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id, attachmentId } = req.params;

    const listResult = await proxyToExternal(baseUrl, `/api/tasks-api/${id}/attachments`, 'GET', apiKey);
    const attachmentList = Array.isArray(listResult?.data?.data) ? listResult.data.data : [];
    const match = attachmentList.find((a: any) => String(a.attachment_id) === String(attachmentId));
    if (!match?.file_path) {
      return res.status(404).json({ success: false, error: 'Attachment not found' });
    }

    const result = await proxyToExternal(
      baseUrl,
      `/api/tasks-api/attachments/${encodeURIComponent(match.file_path)}`,
      'DELETE',
      apiKey,
    );
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/:id/comments ─────────────────────────
softawareTasksRouter.get('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id } = req.params;

    const result = await proxyToExternal(baseUrl, `/api/tasks-api/${id}/comments`, 'GET', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks/:id/comments/with-attachment ────────
// Two-step: create comment, then upload attachment (base64 → file)
// NOTE: Must be registered BEFORE /:id/comments to avoid being shadowed
softawareTasksRouter.post('/:id/comments/with-attachment', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id } = req.params;
    const { content, is_internal, imageBase64, fileName } = req.body;

    if (!imageBase64) throw new Error('imageBase64 is required');

    // Step 1 — create the comment
    const commentBody = {
      content: content || '',
      is_internal: is_internal ?? 1,
      time_spent: 0,
      parent_comment_id: null,
    };
    const commentResult = await proxyToExternal(
      baseUrl, `/api/tasks-api/${id}/comments`, 'POST', apiKey, commentBody
    );

    // Extract the new comment_id from various response shapes
    const commentData = commentResult.data;
    const commentId = commentData?.comment_id
      || commentData?.data?.comment_id
      || commentData?.data?.id
      || commentData?.id;

    if (!commentId) {
      // Comment was created but we couldn't get its ID — return what we have
      return res.status(commentResult.status).json({
        ...commentData,
        attachment_skipped: true,
        message: 'Comment created but attachment could not be linked (no comment_id returned)',
      });
    }

    // Step 2 — upload the drawing as a file attachment
    // Convert base64 data-URL to a Buffer
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const fileBuffer = Buffer.from(base64Data, 'base64');
    const safeName = fileName || 'drawing.png';

    // Build multipart/form-data using native FormData (Node 18+)
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    formData.append('file', blob, safeName);
    formData.append('comment_id', String(commentId));

    const uploadUrl = `${baseUrl.replace(/\/+$/, '')}/api/tasks-api/${id}/attachments`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-API-Key': apiKey,
    };

    const uploadResp = await fetch(uploadUrl, {
      method: 'POST',
      headers,
      body: formData,
    });

    let uploadData: any;
    const ct = uploadResp.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      uploadData = await uploadResp.json();
    } else {
      uploadData = await uploadResp.text();
    }

    res.json({
      success: true,
      comment: commentData,
      comment_id: commentId,
      attachment: uploadData,
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks/:id/comments ────────────────────────
softawareTasksRouter.post('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id } = req.params;

    // Support both legacy { comment } shape and explicit fields
    const { comment, content, is_internal, time_spent, parent_comment_id } = req.body;
    const commentBody = comment || {
      content: content || '',
      is_internal: is_internal ?? 0,
      time_spent: time_spent ?? 0,
      parent_comment_id: parent_comment_id ?? null,
    };

    const result = await proxyToExternal(baseUrl, `/api/tasks-api/${id}/comments`, 'POST', apiKey, commentBody);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/software/authenticate ─────────────────────
// Backwards-compatible stub — no per-user external auth needed anymore
softawareTasksRouter.post('/authenticate', requireAuth, async (_req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'No external authentication required. Source API key is used automatically.',
    token: null,
    user: null,
  });
});

// ─── POST /softaware/tasks/:id/start ───────────────────────────
softawareTasksRouter.post('/:id/start', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id } = req.params;
    const result = await proxyToExternal(baseUrl, `/api/tasks-api/${id}/start`, 'POST', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks/:id/complete ────────────────────────
softawareTasksRouter.post('/:id/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id } = req.params;
    const result = await proxyToExternal(baseUrl, `/api/tasks-api/${id}/complete`, 'POST', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks/:id/approve ─────────────────────────
softawareTasksRouter.post('/:id/approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id } = req.params;
    const result = await proxyToExternal(baseUrl, `/api/tasks-api/${id}/approve`, 'POST', apiKey, req.body || {});
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/pending-approval ─────────────────────
// NOTE: This must be registered before the /:id wildcard route
softawareTasksRouter.get('/pending-approval', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const result = await proxyToExternal(baseUrl, '/api/tasks-api/pending-approval', 'GET', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/stats ────────────────────────────────
softawareTasksRouter.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const result = await proxyToExternal(baseUrl, '/api/tasks-api/stats', 'GET', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks/sync ────────────────────────────────
softawareTasksRouter.post('/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const result = await proxyToExternal(baseUrl, '/api/tasks-api/sync', 'POST', apiKey, req.body);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks/invoice-tasks ───────────────────────
softawareTasksRouter.post('/invoice-tasks', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const result = await proxyToExternal(baseUrl, '/api/tasks-api/invoice-tasks', 'POST', apiKey, req.body);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks/bill ────────────────────────────────
softawareTasksRouter.post('/bill', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const result = await proxyToExternal(baseUrl, '/api/tasks-api/bill', 'POST', apiKey, req.body);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── PUT /softaware/tasks/time ─────────────────────────────────
softawareTasksRouter.put('/time', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const result = await proxyToExternal(baseUrl, '/api/tasks-api/time', 'PUT', apiKey, req.body);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/statement ────────────────────────────
softawareTasksRouter.get('/statement', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const result = await proxyToExternal(baseUrl, '/api/tasks-api/statement', 'GET', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/orders/latest ────────────────────────
softawareTasksRouter.get('/orders/latest', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const result = await proxyToExternal(baseUrl, '/api/tasks-api/orders/latest', 'GET', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/orders/budgets ───────────────────────
softawareTasksRouter.get('/orders/budgets', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const result = await proxyToExternal(baseUrl, '/api/tasks-api/orders/budgets', 'GET', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/orders/:orderNumber/budget ───────────
softawareTasksRouter.get('/orders/:orderNumber/budget', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { orderNumber } = req.params;
    const result = await proxyToExternal(baseUrl, `/api/tasks-api/orders/${encodeURIComponent(orderNumber)}/budget`, 'GET', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/:id/parent ───────────────────────────
softawareTasksRouter.get('/:id/parent', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id } = req.params;
    const result = await proxyToExternal(baseUrl, `/api/tasks-api/${id}/parent`, 'GET', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/:id ──────────────────────────────────
// ─── DELETE /softaware/tasks/comments/:id ──────────────────────
softawareTasksRouter.delete('/comments/:commentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { commentId } = req.params;
    const result = await proxyToExternal(baseUrl, `/api/tasks-api/comments/${commentId}`, 'DELETE', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── POST /softaware/tasks/comments/:id/convert-to-task ───────
softawareTasksRouter.post('/comments/:commentId/convert-to-task', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { commentId } = req.params;
    const result = await proxyToExternal(baseUrl, `/api/tasks-api/comments/${commentId}/convert-to-task`, 'POST', apiKey, req.body || {});
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/attachments/:filename ────────────────
softawareTasksRouter.get('/attachments/:filename', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { filename } = req.params;
    const download = req.query.download === '1' ? '?download=1' : '';
    // Stream the file content directly
    const url = `${baseUrl}/api/tasks-api/attachments/${encodeURIComponent(filename)}${download}`;
    const resp = await fetch(url, { headers: { 'X-API-Key': apiKey } });
    if (!resp.ok) {
      return res.status(resp.status).json({ success: false, error: `HTTP ${resp.status}` });
    }
    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    const contentDisp = resp.headers.get('content-disposition');
    res.setHeader('Content-Type', contentType);
    if (contentDisp) res.setHeader('Content-Disposition', contentDisp);
    const buffer = Buffer.from(await resp.arrayBuffer());
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── GET /softaware/tasks/:id ──────────────────────────────────
// NOTE: MUST be last — this is a wildcard catch-all route
softawareTasksRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey } = await resolveTaskSource(req);
    const { id } = req.params;
    const result = await proxyToExternal(baseUrl, `/api/tasks-api/${id}`, 'GET', apiKey);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
