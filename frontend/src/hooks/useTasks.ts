import { useState, useCallback, useRef } from 'react';
import api from '../services/api';
import { Task } from '../types';

interface UseTasksOptions {
  apiUrl?: string | null;
  autoLoad?: boolean;
}

/**
 * Hook to fetch tasks from an external software API via the backend proxy.
 * Per spec §8.3, calls GET /softaware/tasks?apiUrl={url} with pagination.
 *
 * The software-specific token is stored in localStorage as `software_token`
 * and sent via X-Software-Token header.
 */
export function useTasks({ apiUrl, autoLoad = false }: UseTasksOptions = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevTasksRef = useRef<Task[]>([]);

  const loadTasks = useCallback(async (silent = false) => {
    if (!apiUrl) return;
    if (!silent) setLoading(true);
    setError(null);

    try {
      const allTasks: Task[] = [];
      let page = 1;
      let hasNext = true;

      while (hasNext) {
        const softwareToken = localStorage.getItem('software_token') || '';
        const res = await api.get('/softaware/tasks', {
          params: { apiUrl, page, limit: 1000 },
          headers: softwareToken ? { 'X-Software-Token': softwareToken } : {},
        });

        const body = res.data;
        // External API may return { data: { data: Task[] } } or { data: Task[] }
        const taskData = body?.data?.data || body?.data || body || [];
        const items = Array.isArray(taskData) ? taskData : [];
        allTasks.push(...items);

        const pagination = body?.data?.pagination || body?.pagination;
        hasNext = pagination?.has_next === true;
        page++;

        // Safety limit
        if (page > 50) break;
      }

      // Normalize statuses
      const normalized = allTasks.map((t) => ({
        ...t,
        status: t.status === 'progress' ? 'in-progress' as const : t.status,
      }));

      prevTasksRef.current = normalized;
      setTasks(normalized);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to load tasks';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  return { tasks, loading, error, loadTasks, setTasks };
}
