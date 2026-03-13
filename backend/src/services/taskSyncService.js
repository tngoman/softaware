/**
 * Task Sync Service
 *
 * Pulls tasks from registered external sources and upserts them into `local_tasks`.
 * Each source type has its own adapter that knows how to fetch + normalise tasks.
 *
 * Supported source types:
 *   - tasks-api     — PHP portal Tasks API (TASKS_API.md spec)
 *   - software-proxy — External software product APIs (via proxy pattern)
 *
 * The service:
 *   1. Reads active task_sources from DB
 *   2. For each source, fetches all tasks using the appropriate adapter
 *   3. Computes a sync_hash for each task to detect changes
 *   4. Upserts into local_tasks (create / update / mark deleted)
 *   5. Logs the sync run into task_sync_log
 */
import crypto from 'crypto';
import { db, toMySQLDate } from '../db/mysql.js';
// ─── Adapters ───────────────────────────────────────────────────
/**
 * Fetch tasks from a PHP portal Tasks API source (per TASKS_API.md).
 * Uses X-API-Key authentication and paginated GET endpoint.
 */
async function fetchFromTasksApi(source) {
    const baseUrl = source.base_url.replace(/\/+$/, '');
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
    // Authentication
    if (source.api_key) {
        headers[source.auth_header || 'X-API-Key'] = source.api_key;
    }
    // Paginated fetch
    const allTasks = [];
    let page = 1;
    let hasNext = true;
    const limit = 200;
    while (hasNext && page <= 100) {
        const url = `${baseUrl}/api/tasks-api?page=${page}&limit=${limit}`;
        const resp = await fetch(url, { method: 'GET', headers });
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Tasks API responded ${resp.status}: ${text.slice(0, 500)}`);
        }
        const body = await resp.json();
        const tasks = body?.data?.tasks || body?.data || [];
        if (Array.isArray(tasks)) {
            allTasks.push(...tasks);
        }
        const pagination = body?.data?.pagination;
        hasNext = pagination?.has_next === true;
        page++;
    }
    // Normalise each task
    return allTasks.map((t) => normaliseTasksApiTask(t));
}
/**
 * Normalise a task from the PHP Tasks API response shape into our local schema.
 */
function normaliseTasksApiTask(t) {
    return {
        external_id: String(t.id ?? t.task_id ?? ''),
        title: t.title ?? t.task_name ?? '',
        description: t.description ?? t.task_description ?? null,
        notes: t.notes ?? t.task_notes ?? null,
        status: normaliseStatus(t.status ?? t.task_status ?? 'new'),
        type: t.type ?? t.task_type ?? 'general',
        color: t.color ?? t.task_color ?? '#3788d8',
        start_date: parseDatetime(t.start ?? t.task_start),
        end_date: parseDatetime(t.end ?? t.task_end),
        actual_start: parseDatetime(t.actual_start),
        actual_end: parseDatetime(t.actual_end),
        hours: t.hours ?? t.task_hours ?? '00:00',
        estimated_hours: parseFloat(t.estimated_hours ?? t.task_estimated_hours ?? '0') || 0,
        assigned_to: t.assigned_to ? Number(t.assigned_to) : null,
        assigned_to_name: t.assigned_to_name ?? null,
        created_by_name: t.created_by_name ?? t.task_created_by_name ?? null,
        user_id: Number(t.user ?? t.user_id ?? 0),
        workflow_phase: t.workflow_phase ?? null,
        approval_required: Number(t.approval_required ?? 0),
        approved_by: t.approved_by ?? null,
        approved_at: parseDatetime(t.approved_at),
        parent_task_id: t.parent_task_id ? Number(t.parent_task_id) : null,
        association_type: t.association_type ?? null,
        association_notes: t.association_notes ?? null,
        task_order: Number(t.order ?? t.task_order ?? 0),
        order_number: t.order_number ?? null,
        software_id: t.software_id ? Number(t.software_id) : null,
        module_id: t.module_id ? Number(t.module_id) : null,
        module_name: t.module_name ?? null,
        task_billed: Number(t.task_billed ?? 0),
        task_bill_date: t.task_bill_date ?? null,
        task_direction: Number(t.task_direction ?? 0),
        task_dev: Number(t.task_dev ?? 0),
        task_deleted: Number(t.task_deleted ?? 0),
        external_created_at: parseDatetime(t.created_at ?? t.time),
        external_updated_at: parseDatetime(t.updated_at ?? t.time),
    };
}
/**
 * Fetch tasks from an external software product API (the proxy pattern).
 * Uses Bearer token authentication.
 */
async function fetchFromSoftwareProxy(source) {
    const baseUrl = source.base_url.replace(/\/+$/, '');
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };
    if (source.api_key) {
        headers['Authorization'] = `Bearer ${source.api_key}`;
    }
    const allTasks = [];
    let page = 1;
    let hasNext = true;
    while (hasNext && page <= 50) {
        const url = `${baseUrl}/api/development/tasks/paginated?page=${page}&limit=1000`;
        const resp = await fetch(url, { method: 'GET', headers });
        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Software API responded ${resp.status}: ${text.slice(0, 500)}`);
        }
        const body = await resp.json();
        const taskData = body?.data?.data || body?.data || body || [];
        const items = Array.isArray(taskData) ? taskData : [];
        allTasks.push(...items);
        const pagination = body?.data?.pagination || body?.pagination;
        hasNext = pagination?.has_next === true;
        page++;
    }
    return allTasks.map((t) => normaliseSoftwareProxyTask(t, source.software_id));
}
/**
 * Normalise a task from the software proxy response shape.
 */
function normaliseSoftwareProxyTask(t, softwareId) {
    return {
        external_id: String(t.id ?? ''),
        title: t.title ?? t.task_name ?? '',
        description: t.description ?? null,
        notes: t.notes ?? null,
        status: normaliseStatus(t.status ?? 'new'),
        type: t.type ?? 'general',
        color: t.backgroundColor ?? t.color ?? '#3788d8',
        start_date: parseDatetime(t.start),
        end_date: parseDatetime(t.due_date ?? t.end),
        actual_start: parseDatetime(t.actual_start),
        actual_end: parseDatetime(t.actual_end),
        hours: t.hours ?? '0',
        estimated_hours: parseFloat(t.estimatedHours ?? t.estimated_hours ?? '0') || 0,
        assigned_to: t.assigned_to ? Number(t.assigned_to) : null,
        assigned_to_name: t.assigned_to_name ?? null,
        created_by_name: t.created_by_name ?? t.creator ?? null,
        user_id: 0,
        workflow_phase: t.workflow_phase ?? null,
        approval_required: Number(t.approval_required ?? 0),
        approved_by: t.approved_by ?? null,
        approved_at: parseDatetime(t.approved_at),
        parent_task_id: t.parent_task_id ? Number(t.parent_task_id) : null,
        association_type: t.association_type ?? null,
        association_notes: null,
        task_order: Number(t.task_order ?? 0),
        order_number: null,
        software_id: softwareId ?? (t.software_id ? Number(t.software_id) : null),
        module_id: t.module_id ? Number(t.module_id) : null,
        module_name: t.module_name ?? null,
        task_billed: Number(t.task_billed ?? 0),
        task_bill_date: t.task_bill_date ?? null,
        task_direction: 0,
        task_dev: 0,
        task_deleted: 0,
        external_created_at: parseDatetime(t.created_at),
        external_updated_at: parseDatetime(t.updated_at ?? t.created_at),
    };
}
const ADAPTERS = {
    'tasks-api': fetchFromTasksApi,
    'software-proxy': fetchFromSoftwareProxy,
};
// ─── Core sync logic ────────────────────────────────────────────
/**
 * Compute a deterministic hash of a normalised task to detect changes.
 */
function computeSyncHash(task) {
    // Sort keys for deterministic JSON
    const payload = JSON.stringify(task, Object.keys(task).sort());
    return crypto.createHash('sha256').update(payload).digest('hex');
}
/**
 * Upsert a batch of normalised tasks into local_tasks for a given source.
 * Returns counts of created, updated, unchanged, and deleted tasks.
 */
async function upsertTasks(sourceId, tasks) {
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let deleted = 0;
    const now = toMySQLDate(new Date());
    const seenExternalIds = new Set();
    for (const task of tasks) {
        if (!task.external_id)
            continue;
        seenExternalIds.add(task.external_id);
        const hash = computeSyncHash(task);
        // Check existing
        const existing = await db.queryOne('SELECT id, sync_hash, local_dirty FROM local_tasks WHERE source_id = ? AND external_id = ?', [sourceId, task.external_id]);
        if (existing) {
            // Skip if hash unchanged and not locally dirty
            if (existing.sync_hash === hash && !existing.local_dirty) {
                unchanged++;
                continue;
            }
            // Update existing (don't overwrite local changes if dirty)
            if (existing.local_dirty) {
                // Just update sync metadata, don't overwrite local edits
                await db.execute('UPDATE local_tasks SET last_synced_at = ?, sync_hash = ? WHERE id = ?', [now, hash, existing.id]);
                unchanged++;
                continue;
            }
            await db.execute(`
        UPDATE local_tasks SET
          title = ?, description = ?, notes = ?, status = ?, type = ?, color = ?,
          start_date = ?, end_date = ?, actual_start = ?, actual_end = ?,
          hours = ?, estimated_hours = ?,
          assigned_to = ?, assigned_to_name = ?, created_by_name = ?, user_id = ?,
          workflow_phase = ?, approval_required = ?, approved_by = ?, approved_at = ?,
          parent_task_id = ?, association_type = ?, association_notes = ?,
          task_order = ?, order_number = ?,
          software_id = ?, module_id = ?, module_name = ?,
          task_billed = ?, task_bill_date = ?,
          task_direction = ?, task_dev = ?, task_deleted = ?,
          external_created_at = ?, external_updated_at = ?,
          last_synced_at = ?, sync_hash = ?,
          updated_at = ?
        WHERE id = ?
      `, [
                task.title, task.description, task.notes, task.status, task.type, task.color,
                task.start_date, task.end_date, task.actual_start, task.actual_end,
                task.hours, task.estimated_hours,
                task.assigned_to, task.assigned_to_name, task.created_by_name, task.user_id,
                task.workflow_phase, task.approval_required, task.approved_by, task.approved_at,
                task.parent_task_id, task.association_type, task.association_notes,
                task.task_order, task.order_number,
                task.software_id, task.module_id, task.module_name,
                task.task_billed, task.task_bill_date,
                task.task_direction, task.task_dev, task.task_deleted,
                task.external_created_at, task.external_updated_at,
                now, hash,
                now,
                existing.id,
            ]);
            updated++;
        }
        else {
            // Insert new
            await db.execute(`
        INSERT INTO local_tasks (
          source_id, external_id,
          title, description, notes, status, type, color,
          start_date, end_date, actual_start, actual_end,
          hours, estimated_hours,
          assigned_to, assigned_to_name, created_by_name, user_id,
          workflow_phase, approval_required, approved_by, approved_at,
          parent_task_id, association_type, association_notes,
          task_order, order_number,
          software_id, module_id, module_name,
          task_billed, task_bill_date,
          task_direction, task_dev, task_deleted,
          external_created_at, external_updated_at,
          last_synced_at, sync_hash,
          created_at, updated_at
        ) VALUES (
          ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?
        )
      `, [
                sourceId, task.external_id,
                task.title, task.description, task.notes, task.status, task.type, task.color,
                task.start_date, task.end_date, task.actual_start, task.actual_end,
                task.hours, task.estimated_hours,
                task.assigned_to, task.assigned_to_name, task.created_by_name, task.user_id,
                task.workflow_phase, task.approval_required, task.approved_by, task.approved_at,
                task.parent_task_id, task.association_type, task.association_notes,
                task.task_order, task.order_number,
                task.software_id, task.module_id, task.module_name,
                task.task_billed, task.task_bill_date,
                task.task_direction, task.task_dev, task.task_deleted,
                task.external_created_at, task.external_updated_at,
                now, hash,
                now, now,
            ]);
            created++;
        }
    }
    // Soft-delete tasks that no longer exist on the remote (but don't remove locally dirty ones
    // or locally-created tasks like bug-converted tasks whose external_id is non-numeric)
    if (seenExternalIds.size > 0) {
        const placeholders = [...seenExternalIds].map(() => '?').join(',');
        const deletedCount = await db.execute(`UPDATE local_tasks
       SET task_deleted = 1, updated_at = ?
       WHERE source_id = ?
         AND external_id NOT IN (${placeholders})
         AND task_deleted = 0
         AND local_dirty = 0
         AND external_id REGEXP '^[0-9]+$'`, [now, sourceId, ...seenExternalIds]);
        deleted = deletedCount;
    }
    return { created, updated, unchanged, deleted };
}
/**
 * Push locally-dirty tasks back to their source.
 * Only supported for tasks-api sources currently.
 */
async function pushDirtyTasks(source) {
    const allDirtyTasks = await db.query('SELECT * FROM local_tasks WHERE source_id = ? AND local_dirty = 1 AND task_deleted = 0', [source.id]);
    if (allDirtyTasks.length === 0)
        return { pushed: 0, errors: [] };
    // Separate remote-pushable tasks (numeric external_id) from local-only tasks (e.g. bug-converted)
    const dirtyTasks = allDirtyTasks.filter((t) => /^\d+$/.test(String(t.external_id)));
    const localOnlyTasks = allDirtyTasks.filter((t) => !/^\d+$/.test(String(t.external_id)));
    // Clear dirty flag on local-only tasks — they live only in local_tasks
    if (localOnlyTasks.length > 0) {
        const now = toMySQLDate(new Date());
        for (const t of localOnlyTasks) {
            await db.execute('UPDATE local_tasks SET local_dirty = 0 WHERE id = ?', [t.id]);
        }
    }
    const errors = [];
    let pushed = 0;
    if (dirtyTasks.length === 0)
        return { pushed: 0, errors };
    if (source.source_type === 'tasks-api') {
        const baseUrl = source.base_url.replace(/\/+$/, '');
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };
        if (source.api_key) {
            headers[source.auth_header || 'X-API-Key'] = source.api_key;
        }
        // Use the bulk sync endpoint
        const syncPayload = dirtyTasks.map((t) => ({
            task_id: Number(t.external_id),
            task_name: t.title,
            task_description: t.description,
            task_notes: t.notes,
            task_status: t.status,
            task_type: t.type,
            task_color: t.color,
            task_hours: t.hours,
            task_estimated_hours: t.estimated_hours,
            task_dev: t.task_dev,
        }));
        try {
            const resp = await fetch(`${baseUrl}/api/tasks-api/sync`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ tasks: syncPayload }),
            });
            if (resp.ok) {
                const body = await resp.json();
                pushed = (body?.data?.created || 0) + (body?.data?.updated || 0);
                // Clear dirty flag on pushed tasks only
                const now = toMySQLDate(new Date());
                for (const t of dirtyTasks) {
                    await db.execute('UPDATE local_tasks SET local_dirty = 0, last_synced_at = ? WHERE id = ?', [now, t.id]);
                }
            }
            else {
                const text = await resp.text();
                errors.push(`Push failed (${resp.status}): ${text.slice(0, 300)}`);
            }
        }
        catch (err) {
            errors.push(`Push error: ${err.message}`);
        }
    }
    return { pushed, errors };
}
// ─── Public API ─────────────────────────────────────────────────
/**
 * Sync tasks from a single source.
 */
export async function syncSource(sourceId) {
    const source = await db.queryOne('SELECT * FROM task_sources WHERE id = ? AND sync_enabled = 1', [sourceId]);
    if (!source) {
        throw new Error(`Source ${sourceId} not found or disabled`);
    }
    const adapter = ADAPTERS[source.source_type];
    if (!adapter) {
        throw new Error(`No adapter for source type: ${source.source_type}`);
    }
    const t0 = Date.now();
    // Create log entry
    const logId = await db.insert('INSERT INTO task_sync_log (source_id, started_at, status) VALUES (?, NOW(), ?)', [sourceId, 'running']);
    let result;
    try {
        // Step 1: Push dirty tasks first
        const pushResult = await pushDirtyTasks(source);
        if (pushResult.errors.length > 0) {
            console.warn(`[TaskSync] Push errors for source ${source.name}:`, pushResult.errors);
        }
        // Step 2: Fetch from remote
        const tasks = await adapter(source);
        // Step 3: Upsert locally
        const counts = await upsertTasks(source.id, tasks);
        const durationMs = Date.now() - t0;
        // Update source metadata
        await db.execute(`UPDATE task_sources SET
        last_synced_at = NOW(),
        last_sync_status = 'success',
        last_sync_message = ?,
        last_sync_count = ?
      WHERE id = ?`, [`Synced ${tasks.length} tasks (${counts.created} new, ${counts.updated} updated, ${counts.deleted} removed)`, tasks.length, sourceId]);
        // Update log entry
        await db.execute(`UPDATE task_sync_log SET
        finished_at = NOW(), status = 'success',
        tasks_fetched = ?, tasks_created = ?, tasks_updated = ?,
        tasks_unchanged = ?, tasks_deleted = ?, duration_ms = ?
      WHERE id = ?`, [tasks.length, counts.created, counts.updated, counts.unchanged, counts.deleted, durationMs, logId]);
        result = {
            source_id: source.id,
            source_name: source.name,
            status: 'success',
            tasks_fetched: tasks.length,
            tasks_created: counts.created,
            tasks_updated: counts.updated,
            tasks_unchanged: counts.unchanged,
            tasks_deleted: counts.deleted,
            duration_ms: durationMs,
        };
    }
    catch (err) {
        const durationMs = Date.now() - t0;
        await db.execute(`UPDATE task_sources SET
        last_synced_at = NOW(),
        last_sync_status = 'error',
        last_sync_message = ?
      WHERE id = ?`, [err.message?.slice(0, 1000), sourceId]);
        await db.execute(`UPDATE task_sync_log SET
        finished_at = NOW(), status = 'error',
        error_message = ?, duration_ms = ?
      WHERE id = ?`, [err.message?.slice(0, 2000), durationMs, logId]);
        result = {
            source_id: source.id,
            source_name: source.name,
            status: 'error',
            tasks_fetched: 0,
            tasks_created: 0,
            tasks_updated: 0,
            tasks_unchanged: 0,
            tasks_deleted: 0,
            duration_ms: durationMs,
            error: err.message,
        };
    }
    return result;
}
/**
 * Sync all enabled sources.
 */
export async function syncAllSources() {
    const sources = await db.query('SELECT * FROM task_sources WHERE sync_enabled = 1');
    const results = [];
    for (const source of sources) {
        const result = await syncSource(source.id);
        results.push(result);
    }
    return results;
}
/**
 * Check which sources are due for auto-sync and sync them.
 * Call this from a cron/interval timer.
 */
export async function syncDueSources() {
    const dueSources = await db.query(`
    SELECT * FROM task_sources
    WHERE sync_enabled = 1
      AND sync_interval_min > 0
      AND (
        last_synced_at IS NULL
        OR TIMESTAMPDIFF(MINUTE, last_synced_at, NOW()) >= sync_interval_min
      )
  `);
    const results = [];
    for (const source of dueSources) {
        console.log(`[TaskSync] Auto-syncing source: ${source.name} (last synced: ${source.last_synced_at || 'never'})`);
        const result = await syncSource(source.id);
        results.push(result);
    }
    return results;
}
// ─── Helpers ────────────────────────────────────────────────────
function normaliseStatus(status) {
    const s = (status || '').toLowerCase().trim();
    if (s === 'progress')
        return 'in-progress';
    if (['new', 'in-progress', 'completed', 'pending'].includes(s))
        return s;
    return 'new';
}
function parseDatetime(val) {
    if (!val)
        return null;
    const s = String(val).trim();
    if (!s || s === '0' || s === 'null' || s === 'undefined')
        return null;
    // Attempt parse
    const d = new Date(s);
    if (isNaN(d.getTime()))
        return null;
    return toMySQLDate(d);
}
