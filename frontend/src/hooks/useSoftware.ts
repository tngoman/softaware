import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Software } from '../types';

/**
 * Hook to fetch software list from the backend.
 * Maps to GET /softaware/software (which also lives at /updates/software).
 */
export function useSoftware() {
  const [software, setSoftware] = useState<Software[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/softaware/software');
      const data = res.data?.software || res.data?.data || [];
      setSoftware(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load software');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refetch = useCallback(() => {
    load();
  }, [load]);

  return { software, isLoading, error, refetch };
}
