/**
 * Local Tasks Router
 *
 * Manages locally-stored tasks synced from external sources.
 * Provides CRUD for local tasks, source management, and sync operations.
 *
 * Routes:
 *   GET    /local-tasks                      — List local tasks (paginated, filterable)
 *   GET    /local-tasks/:id                  — Get a single local task
 *   PUT    /local-tasks/:id                  — Update a local task (marks dirty)
 *   DELETE /local-tasks/:id                  — Soft-delete a local task
 *
 *   GET    /local-tasks/sources              — List all task sources
 *   POST   /local-tasks/sources              — Register a new source
 *   PUT    /local-tasks/sources/:id          — Update a source
 *   DELETE /local-tasks/sources/:id          — Remove a source + its tasks
 *   POST   /local-tasks/sources/:id/test     — Test connectivity to a source
 *
 *   POST   /local-tasks/sync                 — Sync all enabled sources
 *   POST   /local-tasks/sync/:sourceId       — Sync a specific source
 *   GET    /local-tasks/sync/status           — Get sync status for all sources
 *   GET    /local-tasks/sync/log              — Get sync history log
 */

import { Router, Request, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { db, toMySQLDate } from '../db/mysql.js';
import { syncSource, syncAllSources, type TaskSource, type SyncResult } from '../services/taskSyncService.js';

export const localTasksRouter = Router();

// ─── SOURCES ────────────────────────────────────────────────────

// GET /local-tasks/sources — List all task sources
localTasksRouter.get('/sources', requireAuth, async (_req: Request, res: Response) => {
  try {
    const sources = await db.query<any>(`
      SELECT id, name, source_type, base_url,
             auth_method, auth_header, software_id,
             sync_enabled, sync_interval_min,
             last_synced_at, last_sync_status, last_sync_message, last_sync_count,
             extra_config, created_by, created_at, updated_at
      FROM task_sources
      ORDER BY name
    `);

    // Count tasks per source
    const counts = await db.query<any>(`
      SELECT source_id, COUNT(*) as total,
             SUM(task_deleted = 0) as active,
             SUM(local_dirty = 1) as dirty
      FROM local_tasks
      GROUP BY source_id
    `);
    const countMap = new Map(counts.map((c: any) => [c.source_id, c]));

    const enriched = sources.map((s: any) => {
      const c = countMap.get(s.id);
      return {
        ...s,
        api_key: s.api_key ? '••••••••' : null,  // Never expose keys
        task_count: c ? Number(c.total) : 0,
        active_task_count: c ? Number(c.active) : 0,
        dirty_task_count: c ? Number(c.dirty) : 0,
      };
    });

    res.json({ status: 1, message: 'Success', data: { sources: enriched } });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// POST /local-tasks/sources — Register a new source
localTasksRouter.post('/sources', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, source_type, base_url, api_key, auth_method, auth_header,
            software_id, sync_enabled, sync_interval_min, extra_config } = req.body;

    if (!name || !base_url) {
      return res.status(400).json({ status: 0, message: 'name and base_url are required' });
    }

    const validTypes = ['tasks-api', 'software-proxy', 'github', 'jira', 'manual'];
    if (source_type && !validTypes.includes(source_type)) {
      return res.status(400).json({ status: 0, message: `Invalid source_type. Use: ${validTypes.join(', ')}` });
    }

    const id = await db.insert(`
      INSERT INTO task_sources
        (name, source_type, base_url, api_key, auth_method, auth_header,
         software_id, sync_enabled, sync_interval_min, extra_config, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name,
      source_type || 'tasks-api',
      base_url.replace(/\/+$/, ''),
      api_key || null,
      auth_method || 'api-key',
      auth_header || 'X-API-Key',
      software_id || null,
      sync_enabled !== undefined ? Number(sync_enabled) : 1,
      sync_interval_min ?? 15,
      extra_config ? JSON.stringify(extra_config) : null,
      req.userId || null,
    ]);

    const source = await db.queryOne<any>('SELECT * FROM task_sources WHERE id = ?', [id]);

    res.status(201).json({ status: 1, message: 'Source created', data: { source } });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 0, message: 'A source with that name already exists' });
    }
    res.status(500).json({ status: 0, message: err.message });
  }
});

// PUT /local-tasks/sources/:id — Update a source
localTasksRouter.put('/sources/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const fields: string[] = [];
    const values: any[] = [];

    const allowed = ['name', 'source_type', 'base_url', 'api_key', 'auth_method',
                     'auth_header', 'software_id', 'sync_enabled', 'sync_interval_min', 'extra_config'];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === 'extra_config' ? JSON.stringify(req.body[key]) : req.body[key]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ status: 0, message: 'No fields to update' });
    }

    values.push(id);
    await db.execute(`UPDATE task_sources SET ${fields.join(', ')} WHERE id = ?`, values);

    const source = await db.queryOne<any>('SELECT * FROM task_sources WHERE id = ?', [id]);
    if (!source) return res.status(404).json({ status: 0, message: 'Source not found' });

    res.json({ status: 1, message: 'Source updated', data: { source } });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// DELETE /local-tasks/sources/:id — Remove source + its tasks
localTasksRouter.delete('/sources/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const source = await db.queryOne<any>('SELECT id, name FROM task_sources WHERE id = ?', [id]);
    if (!source) return res.status(404).json({ status: 0, message: 'Source not found' });

    // CASCADE will remove local_tasks and task_sync_log
    await db.execute('DELETE FROM task_sources WHERE id = ?', [id]);

    res.json({ status: 1, message: `Source "${source.name}" and all its tasks deleted` });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// POST /local-tasks/sources/:id/test — Test connectivity
localTasksRouter.post('/sources/:id/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const source = await db.queryOne<TaskSource>('SELECT * FROM task_sources WHERE id = ?', [id]);
    if (!source) return res.status(404).json({ status: 0, message: 'Source not found' });

    const baseUrl = source.base_url.replace(/\/+$/, '');
    const headers: Record<string, string> = { 'Accept': 'application/json' };

    if (source.api_key) {
      if (source.auth_method === 'bearer') {
        headers['Authorization'] = `Bearer ${source.api_key}`;
      } else {
        headers[source.auth_header || 'X-API-Key'] = source.api_key;
      }
    }

    // Try to fetch first page of tasks to verify connectivity
    let testUrl = '';
    if (source.source_type === 'tasks-api') {
      testUrl = `${baseUrl}/api/tasks-api?page=1&limit=1`;
    } else if (source.source_type === 'software-proxy') {
      testUrl = `${baseUrl}/api/development/tasks/paginated?page=1&limit=1`;
    } else {
      testUrl = baseUrl;
    }

    const t0 = Date.now();
    const resp = await fetch(testUrl, { method: 'GET', headers });
    const latencyMs = Date.now() - t0;

    const contentType = resp.headers.get('content-type') || '';
    let body: any = null;
    if (contentType.includes('json')) {
      body = await resp.json();
    }

    if (resp.ok) {
      res.json({
        status: 1,
        message: 'Connection successful',
        data: {
          http_status: resp.status,
          latency_ms: latencyMs,
          response_preview: body ? JSON.stringify(body).slice(0, 500) : null,
        },
      });
    } else {
      res.json({
        status: 0,
        message: `Connection failed: HTTP ${resp.status}`,
        data: { http_status: resp.status, latency_ms: latencyMs },
      });
    }
  } catch (err: any) {
    res.json({ status: 0, message: `Connection error: ${err.message}` });
  }
});

// ─── SYNC ───────────────────────────────────────────────────────

// POST /local-tasks/sync — Sync all enabled sources
localTasksRouter.post('/sync', requireAuth, async (_req: Request, res: Response) => {
  try {
    const results = await syncAllSources();
    const allOk = results.every(r => r.status === 'success');

    res.json({
      status: 1,
      message: allOk
        ? `All ${results.length} sources synced successfully`
        : `Synced ${results.length} sources (${results.filter(r => r.status === 'error').length} had errors)`,
      data: { results },
    });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// POST /local-tasks/sync/:sourceId — Sync a specific source
localTasksRouter.post('/sync/:sourceId', requireAuth, async (req: Request, res: Response) => {
  try {
    const sourceId = Number(req.params.sourceId);
    if (!sourceId) return res.status(400).json({ status: 0, message: 'Invalid source ID' });

    const result = await syncSource(sourceId);

    res.json({
      status: result.status === 'error' ? 0 : 1,
      message: result.status === 'success'
        ? `Synced "${result.source_name}": ${result.tasks_created} created, ${result.tasks_updated} updated, ${result.tasks_unchanged} unchanged`
        : `Sync failed: ${result.error}`,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// GET /local-tasks/sync/status — Sync status for all sources
localTasksRouter.get('/sync/status', requireAuth, async (_req: Request, res: Response) => {
  try {
    const sources = await db.query<any>(`
      SELECT id, name, source_type, sync_enabled, sync_interval_min,
             last_synced_at, last_sync_status, last_sync_message, last_sync_count
      FROM task_sources
      ORDER BY name
    `);

    res.json({ status: 1, message: 'Success', data: { sources } });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// GET /local-tasks/sync/log — Sync history
localTasksRouter.get('/sync/log', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const sourceId = req.query.source_id ? Number(req.query.source_id) : null;

    let sql = `
      SELECT l.*, s.name as source_name
      FROM task_sync_log l
      JOIN task_sources s ON s.id = l.source_id
    `;
    const params: any[] = [];

    if (sourceId) {
      sql += ' WHERE l.source_id = ?';
      params.push(sourceId);
    }

    sql += ' ORDER BY l.started_at DESC LIMIT ?';
    params.push(limit);

    const logs = await db.query<any>(sql, params);

    res.json({ status: 1, message: 'Success', data: { logs } });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// ─── LOCAL TASKS CRUD ───────────────────────────────────────────

// PATCH /local-tasks/bulk — Batch update (for kanban reorder, bulk priority, etc.)
// NOTE: Must be before /:id routes so Express doesn't match "bulk" as an :id
localTasksRouter.patch('/bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const { updates } = req.body; // Array of { id, ...fields }
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ status: 0, message: 'updates array is required' });
    }

    const allowedBulk = ['priority', 'is_bookmarked', 'color_label', 'kanban_order', 'status'];
    let updated = 0;

    for (const item of updates) {
      if (!item.id) continue;
      const fields: string[] = [];
      const values: any[] = [];
      for (const key of allowedBulk) {
        if (item[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(item[key]);
        }
      }
      if (fields.length === 0) continue;
      values.push(item.id);
      await db.execute(`UPDATE local_tasks SET ${fields.join(', ')} WHERE id = ?`, values);
      updated++;
    }

    res.json({ status: 1, message: `${updated} tasks updated` });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// GET /local-tasks/tags — Get all unique tags across tasks
// NOTE: Must be before /:id routes so Express doesn't match "tags" as an :id
localTasksRouter.get('/tags', requireAuth, async (_req: Request, res: Response) => {
  try {
    const rows = await db.query<any>(`
      SELECT DISTINCT j.tag
      FROM local_tasks, JSON_TABLE(local_tags, '$[*]' COLUMNS (tag VARCHAR(100) PATH '$')) j
      WHERE task_deleted = 0 AND local_tags IS NOT NULL
      ORDER BY j.tag
    `);
    const tags = rows.map((r: any) => r.tag);
    res.json({ status: 1, message: 'Success', data: { tags } });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// GET /local-tasks — List local tasks (paginated, filterable)
localTasksRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = (page - 1) * limit;

    // Filters
    const conditions: string[] = ['t.task_deleted = 0'];
    const params: any[] = [];

    if (req.query.status && req.query.status !== 'all') {
      conditions.push('t.status = ?');
      params.push(req.query.status);
    }

    if (req.query.type && req.query.type !== 'all') {
      conditions.push('t.type = ?');
      params.push(req.query.type);
    }

    if (req.query.source_id) {
      conditions.push('t.source_id = ?');
      params.push(Number(req.query.source_id));
    }

    if (req.query.search) {
      const search = `%${req.query.search}%`;
      conditions.push('(t.title LIKE ? OR t.description LIKE ? OR t.external_id LIKE ?)');
      params.push(search, search, search);
    }

    if (req.query.date_from) {
      conditions.push('t.start_date >= ?');
      params.push(req.query.date_from);
    }

    if (req.query.date_to) {
      conditions.push('(t.end_date <= ? OR t.start_date <= ?)');
      params.push(req.query.date_to, req.query.date_to);
    }

    if (req.query.exclude_billed === '1') {
      conditions.push('t.task_billed = 0');
    }

    if (req.query.software_id) {
      conditions.push('t.software_id = ?');
      params.push(Number(req.query.software_id));
    }

    if (req.query.workflow_phase && req.query.workflow_phase !== 'all') {
      conditions.push('t.workflow_phase = ?');
      params.push(req.query.workflow_phase);
    }

    // Local enhancement filters
    if (req.query.priority && req.query.priority !== 'all') {
      conditions.push('t.priority = ?');
      params.push(req.query.priority);
    }

    if (req.query.bookmarked === '1') {
      conditions.push('t.is_bookmarked = 1');
    }

    if (req.query.color_label) {
      conditions.push('t.color_label = ?');
      params.push(req.query.color_label);
    }

    if (req.query.tag) {
      conditions.push('JSON_CONTAINS(t.local_tags, JSON_QUOTE(?))');
      params.push(req.query.tag);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const [countRow] = await db.query<any>(
      `SELECT COUNT(*) as total FROM local_tasks t ${where}`,
      params
    );
    const total = countRow?.total || 0;

    // Fetch page
    const tasks = await db.query<any>(
      `SELECT t.*, s.name as source_name, s.source_type
       FROM local_tasks t
       LEFT JOIN task_sources s ON s.id = t.source_id
       ${where}
       ORDER BY t.task_order ASC, t.external_id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      status: 1,
      message: 'Success',
      data: {
        tasks,
        pagination: {
          current_page: page,
          per_page: limit,
          total,
          total_pages: Math.ceil(total / limit),
          has_next: page * limit < total,
          has_prev: page > 1,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// GET /local-tasks/:id — Single local task
localTasksRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await db.queryOne<any>(
      `SELECT t.*, s.name as source_name, s.source_type
       FROM local_tasks t
       LEFT JOIN task_sources s ON s.id = t.source_id
       WHERE t.id = ?`,
      [id]
    );

    if (!task) return res.status(404).json({ status: 0, message: 'Task not found' });

    res.json({ status: 1, message: 'Success', data: task });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// PUT /local-tasks/:id — Update a local task (marks as dirty for next sync push)
localTasksRouter.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await db.queryOne<any>('SELECT id FROM local_tasks WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ status: 0, message: 'Task not found' });

    const fields: string[] = [];
    const values: any[] = [];

    const allowed = [
      'title', 'description', 'notes', 'status', 'type', 'color',
      'start_date', 'end_date', 'actual_start', 'actual_end',
      'hours', 'estimated_hours',
      'assigned_to', 'assigned_to_name', 'created_by_name',
      'workflow_phase', 'approval_required',
      'parent_task_id', 'association_type', 'association_notes',
      'task_order', 'order_number',
      'software_id', 'module_id', 'module_name',
      'task_billed', 'task_bill_date',
      'task_direction', 'task_dev',
      // Local-only enhancement columns
      'priority', 'is_bookmarked', 'color_label', 'local_tags',
      'kanban_order', 'view_count', 'last_viewed_at',
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ status: 0, message: 'No fields to update' });
    }

    // Mark as dirty so next sync pushes changes back to source
    fields.push('local_dirty = 1');

    values.push(id);
    await db.execute(`UPDATE local_tasks SET ${fields.join(', ')} WHERE id = ?`, values);

    const task = await db.queryOne<any>(
      `SELECT t.*, s.name as source_name FROM local_tasks t
       LEFT JOIN task_sources s ON s.id = t.source_id
       WHERE t.id = ?`,
      [id]
    );

    res.json({ status: 1, message: 'Task updated', data: task });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// DELETE /local-tasks/:id — Soft-delete
localTasksRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const affected = await db.execute(
      'UPDATE local_tasks SET task_deleted = 1, local_dirty = 1, updated_at = NOW() WHERE id = ? AND task_deleted = 0',
      [id]
    );

    if (affected === 0) return res.status(404).json({ status: 0, message: 'Task not found or already deleted' });

    res.json({ status: 1, message: 'Task deleted' });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// ─── LOCAL ENHANCEMENT ENDPOINTS ────────────────────────────────

// PATCH /local-tasks/:id/bookmark — Toggle bookmark
localTasksRouter.patch('/:id/bookmark', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = await db.queryOne<any>('SELECT id, is_bookmarked FROM local_tasks WHERE id = ?', [id]);
    if (!task) return res.status(404).json({ status: 0, message: 'Task not found' });

    const newVal = task.is_bookmarked ? 0 : 1;
    await db.execute('UPDATE local_tasks SET is_bookmarked = ? WHERE id = ?', [newVal, id]);

    res.json({ status: 1, message: newVal ? 'Bookmarked' : 'Unbookmarked', data: { is_bookmarked: newVal } });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// PATCH /local-tasks/:id/priority — Set priority
localTasksRouter.patch('/:id/priority', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;
    const validPriorities = ['urgent', 'high', 'normal', 'low'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ status: 0, message: `Invalid priority. Use: ${validPriorities.join(', ')}` });
    }

    await db.execute('UPDATE local_tasks SET priority = ? WHERE id = ?', [priority, id]);
    res.json({ status: 1, message: 'Priority updated', data: { priority } });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// PATCH /local-tasks/:id/color-label — Set color label
localTasksRouter.patch('/:id/color-label', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { color_label } = req.body; // null to clear
    await db.execute('UPDATE local_tasks SET color_label = ? WHERE id = ?', [color_label || null, id]);
    res.json({ status: 1, message: 'Color label updated', data: { color_label: color_label || null } });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// PATCH /local-tasks/:id/tags — Set tags (full replacement)
localTasksRouter.patch('/:id/tags', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tags } = req.body; // string[]
    const tagJson = Array.isArray(tags) && tags.length > 0 ? JSON.stringify(tags) : null;
    await db.execute('UPDATE local_tasks SET local_tags = ? WHERE id = ?', [tagJson, id]);
    res.json({ status: 1, message: 'Tags updated', data: { local_tags: tags || [] } });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});

// PATCH /local-tasks/:id/view — Record a view (increment view_count + last_viewed_at)
localTasksRouter.patch('/:id/view', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.execute(
      'UPDATE local_tasks SET view_count = view_count + 1, last_viewed_at = NOW() WHERE id = ?',
      [id]
    );
    res.json({ status: 1, message: 'View recorded' });
  } catch (err: any) {
    res.status(500).json({ status: 0, message: err.message });
  }
});
