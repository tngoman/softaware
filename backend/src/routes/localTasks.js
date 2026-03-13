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
import { Router } from 'express';
import { db, toMySQLDate, generateId } from '../db/mysql.js';
import { syncSource, syncAllSources } from '../services/taskSyncService.js';
export const localTasksRouter = Router();
// No-op auth — local-only tool, no login required
const requireAuth = (_req, _res, next) => next();
// ─── SOURCES ────────────────────────────────────────────────────
// GET /local-tasks/sources — List all task sources
localTasksRouter.get('/sources', requireAuth, async (_req, res) => {
    try {
        const sources = await db.query(`
      SELECT id, name, source_type, base_url,
             auth_method, auth_header, software_id,
             sync_enabled, sync_interval_min,
             last_synced_at, last_sync_status, last_sync_message, last_sync_count,
             extra_config, created_by, created_at, updated_at
      FROM task_sources
      ORDER BY name
    `);
        // Count tasks per source
        const counts = await db.query(`
      SELECT source_id, COUNT(*) as total,
             SUM(task_deleted = 0) as active,
             SUM(local_dirty = 1) as dirty
      FROM local_tasks
      GROUP BY source_id
    `);
        const countMap = new Map(counts.map((c) => [c.source_id, c]));
        const enriched = sources.map((s) => {
            const c = countMap.get(s.id);
            return {
                ...s,
                api_key: s.api_key ? '••••••••' : null, // Never expose keys
                task_count: c ? Number(c.total) : 0,
                active_task_count: c ? Number(c.active) : 0,
                dirty_task_count: c ? Number(c.dirty) : 0,
            };
        });
        res.json({ status: 1, message: 'Success', data: { sources: enriched } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// POST /local-tasks/sources — Register a new source
localTasksRouter.post('/sources', requireAuth, async (req, res) => {
    try {
        const { name, source_type, base_url, api_key, auth_method, auth_header, software_id, sync_enabled, sync_interval_min, extra_config } = req.body;
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
        const source = await db.queryOne('SELECT * FROM task_sources WHERE id = ?', [id]);
        res.status(201).json({ status: 1, message: 'Source created', data: { source } });
    }
    catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ status: 0, message: 'A source with that name already exists' });
        }
        res.status(500).json({ status: 0, message: err.message });
    }
});
// PUT /local-tasks/sources/:id — Update a source
localTasksRouter.put('/sources/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const fields = [];
        const values = [];
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
        const source = await db.queryOne('SELECT * FROM task_sources WHERE id = ?', [id]);
        if (!source)
            return res.status(404).json({ status: 0, message: 'Source not found' });
        res.json({ status: 1, message: 'Source updated', data: { source } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// DELETE /local-tasks/sources/:id — Remove source + its tasks
localTasksRouter.delete('/sources/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const source = await db.queryOne('SELECT id, name FROM task_sources WHERE id = ?', [id]);
        if (!source)
            return res.status(404).json({ status: 0, message: 'Source not found' });
        // CASCADE will remove local_tasks and task_sync_log
        await db.execute('DELETE FROM task_sources WHERE id = ?', [id]);
        res.json({ status: 1, message: `Source "${source.name}" and all its tasks deleted` });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// POST /local-tasks/sources/:id/test — Test connectivity
localTasksRouter.post('/sources/:id/test', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const source = await db.queryOne('SELECT * FROM task_sources WHERE id = ?', [id]);
        if (!source)
            return res.status(404).json({ status: 0, message: 'Source not found' });
        const baseUrl = source.base_url.replace(/\/+$/, '');
        const headers = { 'Accept': 'application/json' };
        if (source.api_key) {
            if (source.auth_method === 'bearer') {
                headers['Authorization'] = `Bearer ${source.api_key}`;
            }
            else {
                headers[source.auth_header || 'X-API-Key'] = source.api_key;
            }
        }
        // Try to fetch first page of tasks to verify connectivity
        let testUrl = '';
        if (source.source_type === 'tasks-api') {
            testUrl = `${baseUrl}/api/tasks-api?page=1&limit=1`;
        }
        else if (source.source_type === 'software-proxy') {
            testUrl = `${baseUrl}/api/development/tasks/paginated?page=1&limit=1`;
        }
        else {
            testUrl = baseUrl;
        }
        const t0 = Date.now();
        const resp = await fetch(testUrl, { method: 'GET', headers });
        const latencyMs = Date.now() - t0;
        const contentType = resp.headers.get('content-type') || '';
        let body = null;
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
        }
        else {
            res.json({
                status: 0,
                message: `Connection failed: HTTP ${resp.status}`,
                data: { http_status: resp.status, latency_ms: latencyMs },
            });
        }
    }
    catch (err) {
        res.json({ status: 0, message: `Connection error: ${err.message}` });
    }
});
// ─── SYNC ───────────────────────────────────────────────────────
// GET /local-tasks/sync/enabled — Check if sync is globally enabled
localTasksRouter.get('/sync/enabled', requireAuth, async (_req, res) => {
    try {
        const sources = await db.query('SELECT id, name, sync_enabled FROM task_sources');
        const allEnabled = sources.length > 0 && sources.every((s) => s.sync_enabled === 1);
        const anyEnabled = sources.some((s) => s.sync_enabled === 1);
        res.json({ status: 1, data: { enabled: anyEnabled, all_enabled: allEnabled, sources } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// POST /local-tasks/sync/disable — Disable sync on all sources and open a case
localTasksRouter.post('/sync/disable', requireAuth, async (req, res) => {
    try {
        const { reason, reason_detail, software_name, user_id, user_name } = req.body;
        if (!reason)
            return res.status(400).json({ status: 0, message: 'reason is required' });
        // Disable all sources
        const affected = await db.execute('UPDATE task_sources SET sync_enabled = 0');
        // Create a case
        const caseId = generateId();
        const caseNumber = `CASE-${Date.now().toString().slice(-8)}`;
        const now = toMySQLDate(new Date());
        const title = `Sync Disabled: ${reason}`;
        const reporterLabel = user_name || 'Unknown User';
        const description = [
            `Task sync was manually disabled by **${reporterLabel}**.`,
            ``,
            `**Reason:** ${reason}`,
            reason_detail ? `**Details:** ${reason_detail}` : '',
            software_name ? `**Software:** ${software_name}` : '',
            `**Sources affected:** ${affected}`,
            `**Disabled at:** ${new Date().toISOString()}`,
        ].filter(Boolean).join('\n');
        await db.execute(`INSERT INTO cases (
        id, case_number, title, description, category, severity, status, type, source,
        reported_by, metadata, tags, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            caseId, caseNumber, title, description,
            'other', 'medium', 'open', 'user_reported', 'user_report',
            user_id || null,
            JSON.stringify({ reason, reason_detail, software_name, user_id, user_name, disabled_at: new Date().toISOString() }),
            JSON.stringify(['sync-disabled', 'task-sync']),
            now, now
        ]);
        // Log activity
        await db.execute('INSERT INTO case_activity (id, case_id, user_id, action, new_value, created_at) VALUES (?, ?, ?, ?, ?, ?)', [generateId(), caseId, user_id || null, 'created', caseNumber, now]);
        res.json({
            status: 1,
            message: `Sync disabled. Case ${caseNumber} opened.`,
            data: { sources_disabled: affected, case_number: caseNumber, case_id: caseId },
        });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// POST /local-tasks/sync/enable — Re-enable sync on all sources
localTasksRouter.post('/sync/enable', requireAuth, async (_req, res) => {
    try {
        const affected = await db.execute('UPDATE task_sources SET sync_enabled = 1');
        res.json({ status: 1, message: `Sync re-enabled on ${affected} source(s)`, data: { sources_enabled: affected } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// POST /local-tasks/sync — Sync all enabled sources
localTasksRouter.post('/sync', requireAuth, async (_req, res) => {
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
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// POST /local-tasks/sync/:sourceId — Sync a specific source
localTasksRouter.post('/sync/:sourceId', requireAuth, async (req, res) => {
    try {
        const sourceId = Number(req.params.sourceId);
        if (!sourceId)
            return res.status(400).json({ status: 0, message: 'Invalid source ID' });
        const result = await syncSource(sourceId);
        res.json({
            status: result.status === 'error' ? 0 : 1,
            message: result.status === 'success'
                ? `Synced "${result.source_name}": ${result.tasks_created} created, ${result.tasks_updated} updated, ${result.tasks_unchanged} unchanged`
                : `Sync failed: ${result.error}`,
            data: result,
        });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// GET /local-tasks/sync/status — Sync status for all sources
localTasksRouter.get('/sync/status', requireAuth, async (_req, res) => {
    try {
        const sources = await db.query(`
      SELECT id, name, source_type, sync_enabled, sync_interval_min,
             last_synced_at, last_sync_status, last_sync_message, last_sync_count
      FROM task_sources
      ORDER BY name
    `);
        res.json({ status: 1, message: 'Success', data: { sources } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// GET /local-tasks/sync/log — Sync history
localTasksRouter.get('/sync/log', requireAuth, async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 50, 200);
        const sourceId = req.query.source_id ? Number(req.query.source_id) : null;
        let sql = `
      SELECT l.*, s.name as source_name
      FROM task_sync_log l
      JOIN task_sources s ON s.id = l.source_id
    `;
        const params = [];
        if (sourceId) {
            sql += ' WHERE l.source_id = ?';
            params.push(sourceId);
        }
        sql += ' ORDER BY l.started_at DESC LIMIT ?';
        params.push(limit);
        const logs = await db.query(sql, params);
        res.json({ status: 1, message: 'Success', data: { logs } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// ─── LOCAL TASKS CRUD ───────────────────────────────────────────
// PATCH /local-tasks/bulk — Batch update (for kanban reorder, bulk priority, etc.)
// NOTE: Must be before /:id routes so Express doesn't match "bulk" as an :id
localTasksRouter.patch('/bulk', requireAuth, async (req, res) => {
    try {
        const { updates } = req.body; // Array of { id, ...fields }
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ status: 0, message: 'updates array is required' });
        }
        const allowedBulk = ['priority', 'is_bookmarked', 'color_label', 'kanban_order', 'status'];
        let updated = 0;
        for (const item of updates) {
            if (!item.id)
                continue;
            const fields = [];
            const values = [];
            for (const key of allowedBulk) {
                if (item[key] !== undefined) {
                    fields.push(`${key} = ?`);
                    values.push(item[key]);
                }
            }
            if (fields.length === 0)
                continue;
            values.push(item.id);
            await db.execute(`UPDATE local_tasks SET ${fields.join(', ')} WHERE id = ?`, values);
            updated++;
        }
        res.json({ status: 1, message: `${updated} tasks updated` });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// GET /local-tasks/tags — Get all unique tags across tasks
// NOTE: Must be before /:id routes so Express doesn't match "tags" as an :id
localTasksRouter.get('/tags', requireAuth, async (_req, res) => {
    try {
        const rows = await db.query(`
      SELECT DISTINCT j.tag
      FROM local_tasks, JSON_TABLE(local_tags, '$[*]' COLUMNS (tag VARCHAR(100) PATH '$')) j
      WHERE task_deleted = 0 AND local_tags IS NOT NULL
      ORDER BY j.tag
    `);
        const tags = rows.map((r) => r.tag);
        res.json({ status: 1, message: 'Success', data: { tags } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// ─── INVOICE STAGING ────────────────────────────────────────────
// task_billed: 0 = unbilled, 1 = invoiced (synced), 2 = staged for invoicing (local only)
// POST /local-tasks/invoice/stage — Stage selected tasks for invoicing (local only)
localTasksRouter.post('/invoice/stage', requireAuth, async (req, res) => {
    try {
        const { task_ids, bill_date } = req.body;
        if (!Array.isArray(task_ids) || task_ids.length === 0) {
            return res.status(400).json({ status: 0, message: 'task_ids array required' });
        }
        const date = bill_date || new Date().toISOString().slice(0, 10);
        // Only stage tasks that are currently unbilled (task_billed = 0)
        const placeholders = task_ids.map(() => '?').join(',');
        const affected = await db.execute(`UPDATE local_tasks SET task_billed = 2, task_bill_date = ? WHERE external_id IN (${placeholders}) AND task_billed = 0`, [date, ...task_ids]);
        res.json({ status: 1, message: `${affected} task(s) staged for invoicing`, data: { staged: affected } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// GET /local-tasks/invoice/staged — Get all tasks staged for invoicing
localTasksRouter.get('/invoice/staged', requireAuth, async (_req, res) => {
    try {
        const tasks = await db.query(`SELECT * FROM local_tasks WHERE task_billed = 2 AND task_deleted = 0 ORDER BY task_bill_date DESC, id DESC`);
        res.json({ status: 1, message: 'Success', data: { tasks, count: tasks.length } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// POST /local-tasks/invoice/clear — Clear all staged invoices (reset to unbilled)
localTasksRouter.post('/invoice/clear', requireAuth, async (_req, res) => {
    try {
        const affected = await db.execute(`UPDATE local_tasks SET task_billed = 0, task_bill_date = NULL WHERE task_billed = 2`);
        res.json({ status: 1, message: `${affected} task(s) cleared from invoice staging`, data: { cleared: affected } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// POST /local-tasks/invoice/unstage/:id — Unstage a single task
localTasksRouter.post('/invoice/unstage/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute(`UPDATE local_tasks SET task_billed = 0, task_bill_date = NULL WHERE id = ? AND task_billed = 2`, [id]);
        res.json({ status: 1, message: 'Task removed from invoice staging' });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// POST /local-tasks/invoice/process — Process staged invoices (sync to external portal, then mark as billed)
localTasksRouter.post('/invoice/process', requireAuth, async (req, res) => {
    try {
        const { apiUrl } = req.body;
        if (!apiUrl)
            return res.status(400).json({ status: 0, message: 'apiUrl required' });
        // Get all staged tasks
        const staged = await db.query(`SELECT id, external_id, task_bill_date FROM local_tasks WHERE task_billed = 2 AND task_deleted = 0`);
        if (staged.length === 0) {
            return res.json({ status: 1, message: 'No staged tasks to process', data: { processed: 0 } });
        }
        // Group by bill_date for the external API call
        const billDate = staged[0].task_bill_date || new Date().toISOString().slice(0, 10);
        const externalIds = staged.map((t) => t.external_id).filter(Boolean);
        if (externalIds.length === 0) {
            return res.status(400).json({ status: 0, message: 'No tasks with external IDs to sync' });
        }
        // Resolve the task source to get API key
        const normalizedApiUrl = apiUrl.replace(/\/+$/, '');
        let source = null;
        const baseOrigin = (() => {
            try {
                return new URL(normalizedApiUrl).origin;
            }
            catch {
                return '';
            }
        })();
        if (baseOrigin) {
            source = await db.queryOne(`SELECT id, base_url, api_key FROM task_sources WHERE TRIM(TRAILING '/' FROM base_url) LIKE ? ORDER BY id ASC LIMIT 1`, [`${baseOrigin}%`]);
        }
        if (!source) {
            return res.status(400).json({ status: 0, message: 'Could not resolve task source for the given apiUrl' });
        }
        // Call external portal to invoice tasks
        const url = `${source.base_url.replace(/\/+$/, '')}/api/tasks-api/invoice-tasks`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-API-Key': source.api_key,
            },
            body: JSON.stringify({ task_ids: externalIds, bill_date: billDate }),
        });
        if (!response.ok) {
            const errText = await response.text();
            return res.status(response.status).json({ status: 0, message: `External API error: ${errText}` });
        }
        // Mark all staged tasks as fully invoiced (task_billed = 1)
        const ids = staged.map((t) => t.id);
        const placeholders = ids.map(() => '?').join(',');
        await db.execute(`UPDATE local_tasks SET task_billed = 1 WHERE id IN (${placeholders})`, ids);
        res.json({
            status: 1,
            message: `${staged.length} task(s) invoiced and synced to portal`,
            data: { processed: staged.length, bill_date: billDate },
        });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// ─── BILLING SETTINGS & STATEMENT ───────────────────────────────
// GET /local-tasks/billing-settings — Get billing settings (allocated hours etc.)
localTasksRouter.get('/billing-settings', requireAuth, async (_req, res) => {
    try {
        const row = await db.queryOne(`SELECT setting_value FROM app_settings WHERE setting_key = 'billing_allocated_hours'`);
        res.json({ status: 1, data: { allocated_hours: parseFloat(row?.setting_value || '0') || 0 } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// PUT /local-tasks/billing-settings — Save billing settings (no admin required)
localTasksRouter.put('/billing-settings', requireAuth, async (req, res) => {
    try {
        const { allocated_hours } = req.body;
        const val = parseFloat(allocated_hours) || 0;
        await db.execute(`INSERT INTO app_settings (setting_key, setting_value) VALUES ('billing_allocated_hours', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, [String(val)]);
        res.json({ status: 1, message: 'Billing settings saved', data: { allocated_hours: val } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// GET /local-tasks/billing-dates — Get distinct billing dates (for statement date-range picker)
localTasksRouter.get('/billing-dates', requireAuth, async (req, res) => {
    try {
        const sourceId = req.query.source_id ? Number(req.query.source_id) : null;
        let sql = `
      SELECT DISTINCT task_bill_date
      FROM local_tasks
      WHERE task_billed = 1
        AND task_bill_date IS NOT NULL
        AND task_bill_date != ''
        AND task_bill_date != '0'
        AND LENGTH(task_bill_date) > 5
        AND task_deleted = 0
    `;
        const params = [];
        if (sourceId) {
            sql += ' AND source_id = ?';
            params.push(sourceId);
        }
        sql += ' ORDER BY task_bill_date DESC';
        const rows = await db.query(sql, params);
        const dates = rows.map((r) => r.task_bill_date);
        res.json({ status: 1, message: 'Success', data: { dates } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// GET /local-tasks/statement-excel — Generate Excel statement for a billing date range
localTasksRouter.get('/statement-excel', requireAuth, async (req, res) => {
    try {
        const { date_from, date_to, source_id, allocated_hours } = req.query;
        if (!date_from || !date_to) {
            return res.status(400).json({ status: 0, message: 'date_from and date_to are required' });
        }
        const allocHours = parseFloat(String(allocated_hours || '0')) || 0;
        let sql = `
      SELECT
        t.external_id,
        t.title,
        t.hours,
        t.actual_start,
        t.actual_end,
        t.start_date,
        t.end_date,
        t.created_by_name,
        t.task_bill_date
      FROM local_tasks t
      WHERE t.task_billed = 1
        AND t.task_bill_date IS NOT NULL
        AND t.task_bill_date >= ?
        AND t.task_bill_date <= ?
        AND t.task_deleted = 0
    `;
        const params = [date_from, date_to];
        if (source_id) {
            sql += ' AND t.source_id = ?';
            params.push(Number(source_id));
        }
        sql += ' ORDER BY t.actual_start ASC, t.external_id ASC';
        const tasks = await db.query(sql, params);
        // Helper: convert HH:MM or decimal hours to decimal number
        const toDecimal = (h) => {
            if (!h)
                return 0;
            const s = String(h).trim();
            if (!s.includes(':'))
                return parseFloat(s) || 0;
            const p = s.split(':');
            return (parseInt(p[0]) || 0) + (parseInt(p[1]) || 0) / 60;
        };
        // Format decimal → "Xh" or "Xh Ym" or "Ym"
        const fmtHM = (dec) => {
            if (dec === 0)
                return '0h';
            const hrs = Math.floor(dec);
            const mins = Math.round((dec - hrs) * 60);
            if (hrs > 0 && mins > 0)
                return `${hrs}h ${mins}m`;
            if (hrs > 0)
                return `${hrs}h`;
            return `${mins}m`;
        };
        // Format decimal → "HHh.MMm" (e.g. "104h.30m")
        const fmtHMdot = (dec) => {
            const hrs = Math.floor(dec);
            const mins = Math.round((dec - hrs) * 60);
            return `${hrs}h.${String(mins).padStart(2, '0')}m`;
        };
        // Format date nicely: "Jan 30, 2026, 09:30 AM"
        const fmtDate = (d) => {
            if (!d)
                return '';
            try {
                return new Date(d).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', hour12: true,
                });
            }
            catch {
                return d;
            }
        };
        // Format date only: "30 January 2026"
        const fmtDateOnly = (d) => {
            if (!d)
                return '';
            try {
                return new Date(d).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'long', year: 'numeric',
                });
            }
            catch {
                return d;
            }
        };
        // Compute totals
        let totalHours = 0;
        for (const t of tasks)
            totalHours += toDecimal(t.hours);
        // Period string (earliest actual_start to latest actual_end)
        const starts = tasks.map((t) => t.actual_start || t.start_date).filter(Boolean).sort();
        const ends = tasks.map((t) => t.actual_end || t.end_date).filter(Boolean).sort();
        const periodFrom = starts.length > 0 ? fmtDateOnly(starts[0]) : String(date_from);
        const periodTo = ends.length > 0 ? fmtDateOnly(ends[ends.length - 1]) : String(date_to);
        const balanceHours = allocHours > 0 ? Math.max(0, allocHours - totalHours) : 0;
        // Build worksheet
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();
        const rows = [];
        const COL_COUNT = 5; // TASK NAME, REQUESTER, START, END, HOURS
        // Title header rows
        rows.push(['Support & Development Hours Statement', '', '', '', '']); // row 0
        rows.push([]); // row 1 blank
        rows.push([`Period: ${periodFrom} - ${periodTo}`, '', '', '', '']); // row 2
        rows.push([]); // row 3 blank
        rows.push([`Total:   ${fmtHMdot(totalHours)}`, '', '', '', '']); // row 4
        rows.push([]); // row 5 blank
        if (allocHours > 0) {
            rows.push([`Balance: ${fmtHMdot(balanceHours)}`, '', '', '', '']); // row 6
            rows.push([]); // row 7 blank
        }
        // Table header
        const headerRowIdx = rows.length;
        rows.push(['TASK NAME', 'REQUESTER', 'START', 'END', 'HOURS']);
        // Task data rows
        for (const t of tasks) {
            const dec = toDecimal(t.hours);
            rows.push([
                t.title || '',
                t.created_by_name || '',
                fmtDate(t.actual_start || t.start_date),
                fmtDate(t.actual_end || t.end_date),
                fmtHM(dec),
            ]);
        }
        // Total row
        const totalRowIdx = rows.length;
        rows.push(['', '', '', 'Total:', fmtHMdot(totalHours)]);
        const ws = XLSX.utils.aoa_to_sheet(rows);
        // Column widths
        ws['!cols'] = [
            { wch: 45 }, // TASK NAME
            { wch: 16 }, // REQUESTER
            { wch: 28 }, // START
            { wch: 28 }, // END
            { wch: 12 }, // HOURS
        ];
        // Merge title row across all columns
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } }, // Title
            { s: { r: 2, c: 0 }, e: { r: 2, c: COL_COUNT - 1 } }, // Period
            { s: { r: 4, c: 0 }, e: { r: 4, c: COL_COUNT - 1 } }, // Total
        ];
        if (allocHours > 0) {
            ws['!merges'].push({ s: { r: 6, c: 0 }, e: { r: 6, c: COL_COUNT - 1 } }); // Balance
        }
        // Styling helper
        const headerFill = { fgColor: { rgb: '4472C4' } };
        const headerFont = { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 };
        const titleFont = { bold: true, sz: 16 };
        const metaFont = { bold: true, sz: 11 };
        const altFill = { fgColor: { rgb: 'D6E4F0' } };
        const borderThin = { style: 'thin', color: { rgb: '999999' } };
        const borders = { top: borderThin, bottom: borderThin, left: borderThin, right: borderThin };
        // Apply title style
        const titleCell = ws['A1'];
        if (titleCell) {
            titleCell.s = { font: titleFont };
        }
        // Apply meta styles (Period, Total, Balance)
        for (const r of [2, 4, ...(allocHours > 0 ? [6] : [])]) {
            const ref = XLSX.utils.encode_cell({ r, c: 0 });
            if (ws[ref])
                ws[ref].s = { font: metaFont };
        }
        // Apply header row style
        for (let c = 0; c < COL_COUNT; c++) {
            const ref = XLSX.utils.encode_cell({ r: headerRowIdx, c });
            if (ws[ref]) {
                ws[ref].s = {
                    fill: headerFill,
                    font: headerFont,
                    border: borders,
                    alignment: { horizontal: 'left' },
                };
            }
        }
        // Apply alternating row fill + borders to data rows
        for (let r = headerRowIdx + 1; r < totalRowIdx; r++) {
            const isAlt = (r - headerRowIdx) % 2 === 0;
            for (let c = 0; c < COL_COUNT; c++) {
                const ref = XLSX.utils.encode_cell({ r, c });
                if (!ws[ref])
                    ws[ref] = { t: 's', v: '' };
                ws[ref].s = {
                    border: borders,
                    ...(isAlt ? { fill: altFill } : {}),
                    alignment: { wrapText: true, vertical: 'top' },
                };
            }
        }
        // Total row style
        for (let c = 0; c < COL_COUNT; c++) {
            const ref = XLSX.utils.encode_cell({ r: totalRowIdx, c });
            if (!ws[ref])
                ws[ref] = { t: 's', v: '' };
            ws[ref].s = {
                font: { bold: true, sz: 11 },
                border: { top: { style: 'medium', color: { rgb: '000000' } }, bottom: { style: 'double', color: { rgb: '000000' } } },
            };
        }
        XLSX.utils.book_append_sheet(wb, ws, 'Statement');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const filename = `task_statement_${date_from}_to_${date_to}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(Buffer.from(buf));
    }
    catch (err) {
        console.error('[statement-excel] Error:', err);
        res.status(500).json({ status: 0, message: err.message });
    }
});
// GET /local-tasks — List local tasks (paginated, filterable)
localTasksRouter.get('/', requireAuth, async (req, res) => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const offset = (page - 1) * limit;
        // Filters
        const conditions = ['t.task_deleted = 0'];
        const params = [];
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
        const [countRow] = await db.query(`SELECT COUNT(*) as total FROM local_tasks t ${where}`, params);
        const total = countRow?.total || 0;
        // Fetch page
        const tasks = await db.query(`SELECT t.*, s.name as source_name, s.source_type
       FROM local_tasks t
       LEFT JOIN task_sources s ON s.id = t.source_id
       ${where}
       ORDER BY t.task_order ASC, t.external_id DESC
       LIMIT ? OFFSET ?`, [...params, limit, offset]);
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
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// GET /local-tasks/:id — Single local task
localTasksRouter.get('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const task = await db.queryOne(`SELECT t.*, s.name as source_name, s.source_type
       FROM local_tasks t
       LEFT JOIN task_sources s ON s.id = t.source_id
       WHERE t.id = ?`, [id]);
        if (!task)
            return res.status(404).json({ status: 0, message: 'Task not found' });
        res.json({ status: 1, message: 'Success', data: task });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// PUT /local-tasks/:id — Update a local task (marks as dirty for next sync push)
localTasksRouter.put('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await db.queryOne('SELECT id FROM local_tasks WHERE id = ?', [id]);
        if (!existing)
            return res.status(404).json({ status: 0, message: 'Task not found' });
        const fields = [];
        const values = [];
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
        const task = await db.queryOne(`SELECT t.*, s.name as source_name FROM local_tasks t
       LEFT JOIN task_sources s ON s.id = t.source_id
       WHERE t.id = ?`, [id]);
        res.json({ status: 1, message: 'Task updated', data: task });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// DELETE /local-tasks/:id — Soft-delete
localTasksRouter.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const affected = await db.execute('UPDATE local_tasks SET task_deleted = 1, local_dirty = 1, updated_at = NOW() WHERE id = ? AND task_deleted = 0', [id]);
        if (affected === 0)
            return res.status(404).json({ status: 0, message: 'Task not found or already deleted' });
        res.json({ status: 1, message: 'Task deleted' });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// ─── LOCAL ENHANCEMENT ENDPOINTS ────────────────────────────────
// PATCH /local-tasks/:id/bookmark — Toggle bookmark
localTasksRouter.patch('/:id/bookmark', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const task = await db.queryOne('SELECT id, is_bookmarked FROM local_tasks WHERE id = ?', [id]);
        if (!task)
            return res.status(404).json({ status: 0, message: 'Task not found' });
        const newVal = task.is_bookmarked ? 0 : 1;
        await db.execute('UPDATE local_tasks SET is_bookmarked = ? WHERE id = ?', [newVal, id]);
        res.json({ status: 1, message: newVal ? 'Bookmarked' : 'Unbookmarked', data: { is_bookmarked: newVal } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// PATCH /local-tasks/:id/priority — Set priority
localTasksRouter.patch('/:id/priority', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { priority } = req.body;
        const validPriorities = ['urgent', 'high', 'normal', 'low'];
        if (!validPriorities.includes(priority)) {
            return res.status(400).json({ status: 0, message: `Invalid priority. Use: ${validPriorities.join(', ')}` });
        }
        await db.execute('UPDATE local_tasks SET priority = ? WHERE id = ?', [priority, id]);
        res.json({ status: 1, message: 'Priority updated', data: { priority } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// PATCH /local-tasks/:id/color-label — Set color label
localTasksRouter.patch('/:id/color-label', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { color_label } = req.body; // null to clear
        await db.execute('UPDATE local_tasks SET color_label = ? WHERE id = ?', [color_label || null, id]);
        res.json({ status: 1, message: 'Color label updated', data: { color_label: color_label || null } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// PATCH /local-tasks/:id/tags — Set tags (full replacement)
localTasksRouter.patch('/:id/tags', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { tags } = req.body; // string[]
        const tagJson = Array.isArray(tags) && tags.length > 0 ? JSON.stringify(tags) : null;
        await db.execute('UPDATE local_tasks SET local_tags = ? WHERE id = ?', [tagJson, id]);
        res.json({ status: 1, message: 'Tags updated', data: { local_tags: tags || [] } });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
// PATCH /local-tasks/:id/view — Record a view (increment view_count + last_viewed_at)
localTasksRouter.patch('/:id/view', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('UPDATE local_tasks SET view_count = view_count + 1, last_viewed_at = NOW() WHERE id = ?', [id]);
        res.json({ status: 1, message: 'View recorded' });
    }
    catch (err) {
        res.status(500).json({ status: 0, message: err.message });
    }
});
