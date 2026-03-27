/**
 * useTierLimits — Shared hook for tier-based creation limits.
 *
 * Fetches GET /api/dashboard/limits once per mount and exposes:
 *   • limits       – { tier, sites, assistants, knowledgePages, collections }
 *   • loading      – true while the fetch is in-flight
 *   • canCreate    – helper: canCreate('sites') → boolean
 *   • remaining    – helper: remaining('assistants') → number
 *   • refresh()    – re-fetch (call after a successful creation)
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export interface ResourceUsage {
  used: number;
  limit: number;
}

export interface TierLimits {
  tier: string;
  sites: ResourceUsage;
  assistants: ResourceUsage;
  knowledgePages: ResourceUsage;
  collections: ResourceUsage;
}

const DEFAULTS: TierLimits = {
  tier: 'free',
  sites: { used: 0, limit: 1 },
  assistants: { used: 0, limit: 1 },
  knowledgePages: { used: 0, limit: 50 },
  collections: { used: 0, limit: 1 },
};

type ResourceKey = 'sites' | 'assistants' | 'knowledgePages' | 'collections';

export function useTierLimits() {
  const [limits, setLimits] = useState<TierLimits>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchLimits = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/limits');
      console.log('[useTierLimits] API response:', JSON.stringify(res.data));
      // Use data regardless of success flag — the endpoint always returns valid usage data
      if (res.data?.tier) {
        const parsed = {
          tier: res.data.tier ?? 'free',
          sites: res.data.sites ?? DEFAULTS.sites,
          assistants: res.data.assistants ?? DEFAULTS.assistants,
          knowledgePages: res.data.knowledgePages ?? DEFAULTS.knowledgePages,
          collections: res.data.collections ?? DEFAULTS.collections,
        };
        console.log('[useTierLimits] Parsed limits:', JSON.stringify(parsed));
        setLimits(parsed);
      } else {
        console.warn('[useTierLimits] API returned no tier data');
      }
    } catch (err) {
      console.warn('[useTierLimits] Failed to fetch limits, using defaults', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  const canCreate = useCallback(
    (resource: ResourceKey): boolean => {
      const r = limits[resource];
      return r.used < r.limit;
    },
    [limits],
  );

  const remaining = useCallback(
    (resource: ResourceKey): number => {
      const r = limits[resource];
      return Math.max(0, r.limit - r.used);
    },
    [limits],
  );

  return { limits, loading, canCreate, remaining, refresh: fetchLimits };
}
