/**
 * Public Packages Router
 *
 * Public-facing package pricing endpoint for the landing page
 * and authenticated user package operations.
 *
 * Mount: /packages
 */

import { Router, Request, Response } from 'express';
import * as packageService from '../services/packages.js';

export const packagesRouter = Router();

// ─── Public Endpoints (no auth required) ─────────────────────────────────

/** GET /packages/pricing — public pricing for the landing page */
packagesRouter.get('/pricing', async (_req: Request, res: Response) => {
  try {
    const pricing = await packageService.getPublicPricing();
    res.json({
      success: true,
      consumer: pricing.consumer.map(formatPublicPackage),
      enterprise: pricing.enterprise.map(formatPublicPackage),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch pricing' });
  }
});

/** GET /packages/list — all active public packages */
packagesRouter.get('/list', async (_req: Request, res: Response) => {
  try {
    const packages = await packageService.getPublicPackages();
    res.json({ success: true, packages: packages.map(formatPublicPackage) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch packages' });
  }
});

/** GET /packages/:slug — single package by slug */
packagesRouter.get('/:slug', async (req: Request, res: Response) => {
  try {
    const pkg = await packageService.getPackageBySlug(req.params.slug);
    if (!pkg || !pkg.is_active || !pkg.is_public) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json({ success: true, package: formatPublicPackage(pkg) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch package' });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatPublicPackage(pkg: packageService.Package) {
  let features: string[] = [];
  try {
    features = typeof pkg.features === 'string' ? JSON.parse(pkg.features) : (pkg.features as any) || [];
  } catch { features = []; }

  return {
    id: pkg.id,
    slug: pkg.slug,
    name: pkg.name,
    description: pkg.description,
    package_type: pkg.package_type,
    price_monthly: pkg.price_monthly,
    price_annually: pkg.price_annually,
    credits_included: pkg.credits_included,
    features,
    display_order: pkg.display_order,
    featured: pkg.featured,
    cta_text: pkg.cta_text,
    // Limits (for display)
    max_users: pkg.max_users,
    max_agents: pkg.max_agents,
    max_widgets: pkg.max_widgets,
    max_landing_pages: pkg.max_landing_pages,
    max_enterprise_endpoints: pkg.max_enterprise_endpoints,
  };
}
