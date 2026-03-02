import { useState, useEffect } from 'react';
import api from '../services/api';

export interface Module {
  id: number;
  name: string;
  description?: string;
  software_id: number;
  software_name?: string;
  developer_count?: number;
}

/**
 * Hook to fetch modules for a given software product.
 * Maps to GET /softaware/modules?software_id={id}
 */
export function useModules(softwareId?: number | null) {
  const [modules, setModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!softwareId) { setModules([]); return; }
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/softaware/modules', { params: { software_id: softwareId } });
        const data = res.data?.modules || res.data?.data || [];
        if (!cancelled) setModules(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setModules([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [softwareId]);

  return { modules, isLoading };
}
