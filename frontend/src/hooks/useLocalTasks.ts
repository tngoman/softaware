import { useState, useCallback } from 'react';
import { LocalTasksModel } from '../models/LocalTasksModel';

export interface LocalTask {
  id: number;
  source_id: number;
  external_id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: string;
  type: string;
  color: string | null;
  start_date: string | null;
  end_date: string | null;
  actual_start: string | null;
  actual_end: string | null;
  hours: string | null;
  estimated_hours: number;
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_by_name: string | null;
  workflow_phase: string | null;
  approval_required: number;
  approved_by: string | null;
  approved_at: string | null;
  software_id: number | null;
  module_id: number | null;
  module_name: string | null;
  task_billed: number;
  task_bill_date: string | null;
  task_deleted: number;
  local_dirty: number;
  last_synced_at: string;
  source_name: string;
  source_type: string;
  created_at: string;
  updated_at: string;
}

export interface TaskSourceInfo {
  id: number;
  name: string;
  source_type: string;
  base_url: string;
  sync_enabled: number;
  sync_interval_min: number;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_message: string | null;
  last_sync_count: number;
  task_count: number;
  active_task_count: number;
  dirty_task_count: number;
}

export interface SyncLogEntry {
  id: number;
  source_id: number;
  source_name: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  tasks_fetched: number;
  tasks_created: number;
  tasks_updated: number;
  tasks_unchanged: number;
  tasks_deleted: number;
  error_message: string | null;
  duration_ms: number | null;
}

interface Pagination {
  current_page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface UseLocalTasksOptions {
  autoLoad?: boolean;
}

/**
 * Hook to manage locally-synced tasks.
 * Provides task listing, filtering, sync triggering, and source management.
 */
export function useLocalTasks(_options: UseLocalTasksOptions = {}) {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [sources, setSources] = useState<TaskSourceInfo[]>([]);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Load local tasks with optional filters */
  const loadTasks = useCallback(async (params: Record<string, any> = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await LocalTasksModel.getAll(params);
      setTasks(res.data?.tasks || []);
      setPagination(res.data?.pagination || null);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  /** Load task sources */
  const loadSources = useCallback(async () => {
    try {
      const res = await LocalTasksModel.getSources();
      setSources(res.data?.sources || []);
    } catch (err: any) {
      console.error('Failed to load sources:', err);
    }
  }, []);

  /** Load sync log */
  const loadSyncLog = useCallback(async (params?: { source_id?: number; limit?: number }) => {
    try {
      const res = await LocalTasksModel.getSyncLog(params);
      setSyncLog(res.data?.logs || []);
    } catch (err: any) {
      console.error('Failed to load sync log:', err);
    }
  }, []);

  /** Trigger sync for all sources */
  const syncAll = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await LocalTasksModel.syncAll();
      return res;
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Sync failed');
      throw err;
    } finally {
      setSyncing(false);
    }
  }, []);

  /** Trigger sync for a specific source */
  const syncSourceById = useCallback(async (sourceId: number) => {
    setSyncing(true);
    try {
      const res = await LocalTasksModel.syncSource(sourceId);
      return res;
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Sync failed');
      throw err;
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    // State
    tasks,
    pagination,
    sources,
    syncLog,
    loading,
    syncing,
    error,

    // Actions
    loadTasks,
    loadSources,
    loadSyncLog,
    syncAll,
    syncSourceById,
    setTasks,
  };
}
