import { useState, useCallback, useRef } from 'react';
import api from '../services/api';
import { Task } from '../types';

interface UseTasksOptions {
  apiUrl?: string | null;
  softwareId?: number | null;
  autoLoad?: boolean;
}

/**
 * Hook to fetch tasks from the LOCAL database (synced from external sources).
 * Calls GET /local-tasks with optional filters. No external auth required —
 * tasks are already cached locally by the sync service.
 *
 * Falls back to the proxy path if `useProxy` is true (not default).
 */
export function useTasks({ softwareId }: UseTasksOptions = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevTasksRef = useRef<Task[]>([]);

  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      // Fetch ALL local tasks (no pagination needed for typical counts)
      const params: Record<string, any> = { limit: 200, page: 1 };
      if (softwareId) params.software_id = softwareId;

      const allTasks: Task[] = [];
      let page = 1;
      let hasNext = true;

      while (hasNext) {
        params.page = page;
        const res = await api.get('/local-tasks', { params });
        const body = res.data;
        const taskData = body?.data?.tasks || body?.data || [];
        const items = Array.isArray(taskData) ? taskData : [];
        allTasks.push(...items);

        const pagination = body?.data?.pagination;
        hasNext = pagination?.has_next === true;
        page++;
        if (page > 50) break;
      }

      // Normalize local_tasks fields to match the Task interface
      const normalized = allTasks.map((t: any) => ({
        ...t,
        // Map local DB fields → Task interface fields
        id: t.external_id || t.id,
        title: t.title || '',
        status: t.status === 'progress' ? 'in-progress' as const : t.status,
        type: t.type || 'general',
        hours: t.hours || '0',
        estimatedHours: String(t.estimated_hours ?? '0'),
        estimated_hours: t.estimated_hours,
        created_at: t.external_created_at || t.created_at || null,
        start: t.start_date || null,
        end: t.end_date || null,
        due_date: t.end_date || null,
        backgroundColor: t.color || '#667eea',
        time: t.external_created_at || t.created_at || null,
        // Keep source tracking
        _local_id: t.id,
        _source_id: t.source_id,
        _source_name: t.source_name,
        _local_dirty: t.local_dirty,
        _last_synced_at: t.last_synced_at,
      }));

      prevTasksRef.current = normalized;
      setTasks(normalized);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to load tasks';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [softwareId]);

  return { tasks, loading, error, loadTasks, setTasks };
}
