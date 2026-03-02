import { useState, useEffect } from 'react';
import { getApiBaseUrl, getBaseUrl } from '../config/app';

export interface Branding {
  site_name: string;
  site_title: string;
  site_description: string;
  site_logo: string;
  site_icon: string;
}

const CACHE_KEY = 'app_branding';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Try to read branding from sessionStorage cache.
 */
function getCachedBranding(): Branding | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data as Branding;
  } catch {
    return null;
  }
}

function setCachedBranding(data: Branding): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore quota errors
  }
}

/**
 * Hook: loads public branding settings (logo, site name, etc.)
 * Works for both authenticated and unauthenticated users.
 * Caches in sessionStorage for 5 min to avoid repeated requests.
 */
export function useAppSettings() {
  const [branding, setBranding] = useState<Branding | null>(getCachedBranding);
  const [loading, setLoading] = useState(!branding);

  useEffect(() => {
    // If we already have cached data, skip fetch
    if (branding) return;

    let cancelled = false;
    const fetchBranding = async () => {
      try {
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/app-settings/branding`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Branding = await res.json();
        if (!cancelled) {
          setBranding(data);
          setCachedBranding(data);
        }
      } catch (err) {
        console.warn('Failed to load branding settings:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchBranding();
    return () => { cancelled = true; };
  }, [branding]);

  /**
   * Build the full URL for a branding image (logo or icon).
   */
  const getLogoUrl = (filename?: string): string | undefined => {
    if (!filename) return undefined;
    const base = getBaseUrl();
    return `${base}/assets/images/${filename}`;
  };

  return {
    branding,
    loading,
    logoUrl: getLogoUrl(branding?.site_logo),
    iconUrl: getLogoUrl(branding?.site_icon),
    siteName: branding?.site_name || 'Soft Aware',
  };
}
