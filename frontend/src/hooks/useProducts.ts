/**
 * useProducts — Determines which products the current user has access to.
 *
 * Calls GET /api/dashboard/products and exposes:
 *   • products       – { ai_assistant: boolean, api_gateway: boolean }
 *   • packageInfo    – { slug, name, status, tier } | null
 *   • gatewaySummary – gateway configs with tool counts, usage, etc.
 *   • assistantSummary – { assistant_count, site_count }
 *   • loading        – true while the fetch is in-flight
 *   • refresh()      – re-fetch
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export interface GatewayInfo {
  client_id: string;
  client_name: string;
  status: 'active' | 'paused' | 'disabled';
  target_base_url: string;
  auth_type: string;
  tools_count: number;
  tools: string[];
  rate_limit_rpm: number;
  total_requests: number;
  last_request_at: string | null;
  created_at: string;
}

export interface GatewaySummary {
  total_gateways: number;
  gateways: GatewayInfo[];
}

export interface ProductFlags {
  ai_assistant: boolean;
  api_gateway: boolean;
}

export interface PackageInfo {
  slug: string;
  name: string;
  status: string;
  tier: string;
}

export interface AssistantSummary {
  assistant_count: number;
  site_count: number;
}

const DEFAULT_PRODUCTS: ProductFlags = { ai_assistant: true, api_gateway: false };

export function useProducts() {
  const [products, setProducts] = useState<ProductFlags>(DEFAULT_PRODUCTS);
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);
  const [gatewaySummary, setGatewaySummary] = useState<GatewaySummary | null>(null);
  const [assistantSummary, setAssistantSummary] = useState<AssistantSummary>({ assistant_count: 0, site_count: 0 });
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get('/dashboard/products');
      if (res.data?.products) {
        setProducts(res.data.products);
        setPackageInfo(res.data.package ?? null);
        setGatewaySummary(res.data.gateway_summary ?? null);
        setAssistantSummary(res.data.assistant_summary ?? { assistant_count: 0, site_count: 0 });
      }
    } catch (err) {
      console.warn('[useProducts] Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    packageInfo,
    gatewaySummary,
    assistantSummary,
    loading,
    refresh: fetchProducts,
  };
}
