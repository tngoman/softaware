import { useState, useCallback, useRef } from 'react';
import { Bug } from '../types';
import { BugsModel } from '../models/BugsModel';

interface UseBugsOptions {
  softwareId?: number | null;
}

/**
 * Hook to fetch bugs from the local bugs system.
 * Calls GET /bugs with optional software_id filter.
 */
export function useBugs({ softwareId }: UseBugsOptions = {}) {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevBugsRef = useRef<Bug[]>([]);

  const loadBugs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const params: Record<string, any> = { limit: 200, page: 1 };
      if (softwareId) params.software_id = softwareId;

      const allBugs: Bug[] = [];
      let page = 1;
      let hasNext = true;

      while (hasNext) {
        params.page = page;
        const body = await BugsModel.getAll(params);
        const bugData = body?.data?.bugs || body?.data || [];
        const items = Array.isArray(bugData) ? bugData : [];
        allBugs.push(...items);

        const pagination = body?.data?.pagination;
        hasNext = pagination?.has_next === true;
        page++;
        if (page > 50) break;
      }

      prevBugsRef.current = allBugs;
      setBugs(allBugs);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to load bugs';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [softwareId]);

  return { bugs, loading, error, loadBugs, setBugs };
}
