/**
 * Package Enforcement Middleware
 *
 * Reusable guards that resolve a contact's package tier and enforce
 * specific limits before allowing resource creation.
 *
 * These guards work with the NEW contact-scoped package system:
 *   contacts → contact_packages → packages
 *
 * Usage:
 *   router.post('/', enforceEndpointLimit, handler);   // checks max_enterprise_endpoints
 *   router.post('/', enforceKnowledgeLimit, handler);   // checks maxKnowledgePages
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { db } from '../db/mysql.js';
import { packageRowToTierLimits, resolveTrialLimits, type PackageCatalogRow } from '../services/packageResolver.js';
import { getAllEndpoints } from '../services/enterpriseEndpoints.js';
import { getAllConfigs } from '../services/clientApiGateway.js';

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

interface ContactPackageInfo {
  contact_id: number;
  contact_name: string;
  package_slug: string;
  package_name: string;
  package_type: string;
  package_status: string;
  limits: ReturnType<typeof packageRowToTierLimits>;
  rawPackage: PackageCatalogRow;
}

// ───────────────────────────────────────────────────────────────────────────
// Core resolver: contact_id → active package + limits
// ───────────────────────────────────────────────────────────────────────────

export async function resolveContactPackage(contactId: number): Promise<ContactPackageInfo | null> {
  const row = await db.queryOne<any>(
    `SELECT
       c.id        AS contact_id,
       c.company_name AS contact_name,
       cp.status   AS package_status,
       p.*
     FROM contacts c
     JOIN contact_packages cp ON cp.contact_id = c.id AND cp.status IN ('ACTIVE', 'TRIAL')
     JOIN packages p ON p.id = cp.package_id AND p.is_active = 1
     WHERE c.id = ?
     ORDER BY CASE cp.status WHEN 'ACTIVE' THEN 0 WHEN 'TRIAL' THEN 1 ELSE 2 END,
              cp.updated_at DESC
     LIMIT 1`,
    [contactId],
  );

  if (!row) return null;

  const rawPackage = row as PackageCatalogRow;
  const fullLimits = packageRowToTierLimits(rawPackage);
  return {
    contact_id: Number(row.contact_id),
    contact_name: row.contact_name,
    package_slug: row.slug,
    package_name: row.name,
    package_type: row.package_type,
    package_status: row.package_status,
    limits: resolveTrialLimits(row.package_status, rawPackage.package_type, fullLimits),
    rawPackage,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Helper: standard enforcement error response
// ───────────────────────────────────────────────────────────────────────────

function deny(res: Response, code: string, message: string, details?: Record<string, unknown>) {
  return res.status(403).json({
    success: false,
    error: code,
    message,
    ...details,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Guard: Enterprise Endpoint Limit
//
// Checks:
//   1. contact_id is provided
//   2. Contact has an active package
//   3. Package allows omni-channel / enterprise endpoints (has_omni_channel_endpoints)
//      — OR the package has max_enterprise_endpoints > 0
//   4. Contact hasn't exceeded max_enterprise_endpoints
// ═══════════════════════════════════════════════════════════════════════════

export async function enforceEndpointLimit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const contactId = req.body?.contact_id;

    if (!contactId) {
      deny(res, 'CONTACT_REQUIRED',
        'A contact_id is required. Every enterprise endpoint must be linked to a client account.');
      return;
    }

    const pkg = await resolveContactPackage(Number(contactId));

    if (!pkg) {
      deny(res, 'NO_ACTIVE_PACKAGE',
        'This contact does not have an active package. Assign a package before creating enterprise resources.');
      return;
    }

    const maxEndpoints = pkg.rawPackage.max_enterprise_endpoints ?? 0;

    // Enterprise / Staff tiers always pass (effectively unlimited)
    if (pkg.package_type === 'ENTERPRISE' || pkg.package_type === 'STAFF') {
      (req as any).resolvedPackage = pkg;
      return next();
    }

    // Check if the package tier permits enterprise endpoints at all
    if (maxEndpoints <= 0) {
      deny(res, 'TIER_LIMIT_REACHED',
        `The ${pkg.package_name} package does not include enterprise endpoints. Upgrade to a plan that supports this feature.`,
        { current_package: pkg.package_slug, limit: 0 });
      return;
    }

    // Count existing endpoints for this contact (across both systems)
    const allEndpoints = getAllEndpoints();
    const contactEndpointCount = allEndpoints.filter(
      (ep) => (ep as any).contact_id === Number(contactId),
    ).length;

    if (contactEndpointCount >= maxEndpoints) {
      deny(res, 'TIER_LIMIT_REACHED',
        `This contact has reached the enterprise endpoint limit for the ${pkg.package_name} package (${contactEndpointCount}/${maxEndpoints}). Upgrade to create more.`,
        { current: contactEndpointCount, limit: maxEndpoints, package: pkg.package_slug });
      return;
    }

    // Attach resolved package for downstream handlers
    (req as any).resolvedPackage = pkg;
    next();
  } catch (err) {
    console.error('[PackageEnforcement] Endpoint limit check failed:', err);
    res.status(500).json({ success: false, error: 'Failed to verify package limits' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Guard: Client API Gateway Limit
//
// Similar to endpoint limit but counts client_api_configs for the contact.
// Uses max_enterprise_endpoints as the cap (gateways are tied to endpoints).
// ═══════════════════════════════════════════════════════════════════════════

export async function enforceGatewayLimit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const contactId = req.body?.contact_id;

    if (!contactId) {
      deny(res, 'CONTACT_REQUIRED',
        'A contact_id is required. Every client API gateway must be linked to a client account.');
      return;
    }

    const pkg = await resolveContactPackage(Number(contactId));

    if (!pkg) {
      deny(res, 'NO_ACTIVE_PACKAGE',
        'This contact does not have an active package. Assign a package before creating gateways.');
      return;
    }

    // Enterprise / Staff always pass
    if (pkg.package_type === 'ENTERPRISE' || pkg.package_type === 'STAFF') {
      (req as any).resolvedPackage = pkg;
      return next();
    }

    const maxEndpoints = pkg.rawPackage.max_enterprise_endpoints ?? 0;
    if (maxEndpoints <= 0) {
      deny(res, 'TIER_LIMIT_REACHED',
        `The ${pkg.package_name} package does not include client API gateways. Upgrade to a plan that supports this feature.`,
        { current_package: pkg.package_slug, limit: 0 });
      return;
    }

    const allConfigs = getAllConfigs();
    const contactConfigCount = allConfigs.filter(
      (cfg) => (cfg as any).contact_id === Number(contactId),
    ).length;

    if (contactConfigCount >= maxEndpoints) {
      deny(res, 'TIER_LIMIT_REACHED',
        `This contact has reached the gateway limit for the ${pkg.package_name} package (${contactConfigCount}/${maxEndpoints}). Upgrade to create more.`,
        { current: contactConfigCount, limit: maxEndpoints, package: pkg.package_slug });
      return;
    }

    (req as any).resolvedPackage = pkg;
    next();
  } catch (err) {
    console.error('[PackageEnforcement] Gateway limit check failed:', err);
    res.status(500).json({ success: false, error: 'Failed to verify package limits' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Guard: Knowledge Page Limit
//
// For assistant ingestion — checks the owner's package maxKnowledgePages
// against the current pages_indexed count on the assistant.
// ═══════════════════════════════════════════════════════════════════════════

export async function enforceKnowledgePageLimit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) return next();

    // Resolve assistant → owner → contact → package
    const assistantId = req.params.assistantId;
    if (!assistantId) return next();

    const assistant = await db.queryOne<{ userId: string; pages_indexed: number }>(
      'SELECT userId, pages_indexed FROM assistants WHERE id = ?',
      [assistantId],
    );
    if (!assistant) return next();

    // Resolve the owner's contact
    const user = await db.queryOne<{ contact_id: number | null }>(
      'SELECT contact_id FROM users WHERE id = ?',
      [assistant.userId],
    );
    if (!user?.contact_id) return next(); // No contact linked — let existing guards handle

    const pkg = await resolveContactPackage(user.contact_id);
    if (!pkg) return next(); // No package — let existing guards handle

    const maxPages = pkg.limits.maxKnowledgePages;
    const currentPages = assistant.pages_indexed || 0;

    if (currentPages >= maxPages) {
      deny(res, 'KNOWLEDGE_LIMIT_REACHED',
        `This assistant has reached the knowledge page limit for the ${pkg.package_name} package (${currentPages}/${maxPages}). Upgrade to ingest more.`,
        { current: currentPages, limit: maxPages, package: pkg.package_slug });
      return;
    }

    (req as any).resolvedPackage = pkg;
    next();
  } catch (err) {
    console.error('[PackageEnforcement] Knowledge page limit check failed:', err);
    next(); // Don't block on error — existing hardcoded limits still apply
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Guard: Vision / File Processing Access
//
// Vision (image/file analysis) is ONLY available on Advanced and Enterprise.
// Free, Starter, and Pro packages (including Pro Trial) CANNOT process files.
// This is a hard gate — files are rejected before any processing occurs.
//
// Usage (inline — not middleware):
//   const result = await checkVisionAccess(contactId);
//   if (!result.allowed) { /* reject with 403 */ }
//
// Also exported as middleware for route-level enforcement:
//   router.post('/chat', enforceVisionAccess, handler);
// ═══════════════════════════════════════════════════════════════════════════

export async function checkVisionAccess(contactId: number): Promise<{
  allowed: boolean;
  packageName: string;
  packageSlug: string;
  reason?: string;
}> {
  const pkg = await resolveContactPackage(contactId);
  if (!pkg) {
    return { allowed: false, packageName: 'None', packageSlug: 'none', reason: 'No active package found' };
  }

  // Enterprise / Staff always have vision access
  if (pkg.package_type === 'ENTERPRISE' || pkg.package_type === 'STAFF') {
    return { allowed: true, packageName: pkg.package_name, packageSlug: pkg.package_slug };
  }

  if (!pkg.limits.hasVision) {
    return {
      allowed: false,
      packageName: pkg.package_name,
      packageSlug: pkg.package_slug,
      reason: `Vision/file processing is not available on the ${pkg.package_name} package. Upgrade to Advanced or Enterprise to unlock image and file analysis.`,
    };
  }

  return { allowed: true, packageName: pkg.package_name, packageSlug: pkg.package_slug };
}

export async function enforceVisionAccess(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) return next();

    const user = await db.queryOne<{ contact_id: number | null }>(
      'SELECT contact_id FROM users WHERE id = ?',
      [userId],
    );
    if (!user?.contact_id) return next();

    const result = await checkVisionAccess(user.contact_id);
    if (!result.allowed) {
      deny(res, 'VISION_NOT_AVAILABLE', result.reason || 'Vision is not available on your current package.',
        { current_package: result.packageSlug, required: 'advanced or enterprise' });
      return;
    }

    next();
  } catch (err) {
    console.error('[PackageEnforcement] Vision access check failed:', err);
    next(); // Don't block on error
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility: Check if a specific system action is allowed for a contact
// ═══════════════════════════════════════════════════════════════════════════

export function createSystemActionGuard(actionName: string) {
  return async function enforceSystemAction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) return next();

      const user = await db.queryOne<{ contact_id: number | null }>(
        'SELECT contact_id FROM users WHERE id = ?',
        [userId],
      );
      if (!user?.contact_id) return next();

      const pkg = await resolveContactPackage(user.contact_id);
      if (!pkg) return next();

      // Enterprise / Staff always have full access
      if (pkg.package_type === 'ENTERPRISE' || pkg.package_type === 'STAFF') {
        (req as any).resolvedPackage = pkg;
        return next();
      }

      if (!pkg.limits.allowedSystemActions.includes(actionName)) {
        deny(res, 'ACTION_NOT_ALLOWED',
          `The "${actionName}" feature is not available on the ${pkg.package_name} package. Upgrade to unlock this feature.`,
          { action: actionName, current_package: pkg.package_slug, allowed_actions: pkg.limits.allowedSystemActions });
        return;
      }

      (req as any).resolvedPackage = pkg;
      next();
    } catch (err) {
      console.error(`[PackageEnforcement] System action guard (${actionName}) failed:`, err);
      next();
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility: Inline check for contact — no middleware needed
// ═══════════════════════════════════════════════════════════════════════════

export async function checkContactEndpointQuota(contactId: number): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
  packageName: string;
  packageSlug: string;
}> {
  const pkg = await resolveContactPackage(contactId);
  if (!pkg) {
    return { allowed: false, current: 0, limit: 0, packageName: 'None', packageSlug: 'none' };
  }

  if (pkg.package_type === 'ENTERPRISE' || pkg.package_type === 'STAFF') {
    return { allowed: true, current: 0, limit: 999, packageName: pkg.package_name, packageSlug: pkg.package_slug };
  }

  const maxEndpoints = pkg.rawPackage.max_enterprise_endpoints ?? 0;
  const allEndpoints = getAllEndpoints();
  const current = allEndpoints.filter((ep) => (ep as any).contact_id === contactId).length;

  return {
    allowed: current < maxEndpoints,
    current,
    limit: maxEndpoints,
    packageName: pkg.package_name,
    packageSlug: pkg.package_slug,
  };
}
