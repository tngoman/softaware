/**
 * Package Middleware
 *
 * Middleware for enforcing package limits and tracking credit usage
 * against contact_packages. Replaces the legacy team-scoped credit middleware.
 *
 * Usage:
 *   router.use(requirePackage);            // Sets req.contactId, req.contactPackageId
 *   router.use(requireCredits);            // Blocks if no credits
 *   router.use(packageCreditMiddleware);   // Full enforcement: check + deduct
 *
 * Must be placed AFTER requireAuth so req.user is available.
 */

import { Request, Response, NextFunction } from 'express';
import * as packageService from '../services/packages.js';

/**
 * Inline request pricing — package-credit costs per request type.
 * Kept minimal after removal of the legacy credit system.
 */
const REQUEST_PRICING: Record<string, { baseCost: number; perTokenCost?: number; perMultiplier?: number }> = {
  TEXT_CHAT:          { baseCost: 10, perTokenCost: 0.01 },
  TEXT_SIMPLE:        { baseCost: 5,  perTokenCost: 0.005 },
  AI_BROKER:          { baseCost: 1 },
  CODE_AGENT_EXECUTE: { baseCost: 20, perTokenCost: 0.02 },
  FILE_OPERATION:     { baseCost: 1 },
  MCP_TOOL:           { baseCost: 5,  perMultiplier: 1.0 },
};

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      contactId?: number;
      contactPackageId?: number;
      creditBalance?: number;
    }
  }
}

/**
 * Resolves the contact for the authenticated user.
 * Sets req.contactId from user_contact_link.
 * Falls back to checking if user has any linked contact.
 */
export function requirePackage(req: Request, res: Response, next: NextFunction): void {
  (async () => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const link = await packageService.getUserContact(userId);
      if (!link) {
        res.status(403).json({
          error: 'NO_PACKAGE',
          message: 'No package subscription found. Please subscribe to a package first.',
        });
        return;
      }

      req.contactId = link.contactId;

      // Find primary active subscription
      const subs = await packageService.getContactPackages(link.contactId);
      const activeSub = subs.find(s => s.status === 'ACTIVE' || s.status === 'TRIAL');
      if (activeSub) {
        req.contactPackageId = activeSub.id;
        req.creditBalance = activeSub.credits_balance;
      }

      next();
    } catch (err: any) {
      console.error('[PackageMiddleware] Error resolving contact:', err.message);
      res.status(500).json({ error: 'Failed to resolve package subscription' });
    }
  })();
}

/**
 * Pre-handler check: blocks with 402 if the contact has no credits.
 * Must be placed after requirePackage.
 */
export function requireCredits(req: Request, res: Response, next: NextFunction): void {
  (async () => {
    try {
      const contactId = req.contactId;
      if (!contactId) {
        res.status(403).json({ error: 'NO_PACKAGE', message: 'No package found' });
        return;
      }

      const { total } = await packageService.getBalance(contactId);

      // Set informational headers
      res.setHeader('X-Credit-Balance', total.toString());
      res.setHeader('X-Credit-Low-Balance', total < 5000 ? '1' : '0');

      if (total <= 0) {
        res.status(402).json({
          error: 'INSUFFICIENT_CREDITS',
          message: 'Your package has no remaining credits. Please top up or upgrade your package.',
          balance: 0,
        });
        return;
      }

      req.creditBalance = total;
      next();
    } catch (err: any) {
      console.error('[PackageMiddleware] Error checking credits:', err.message);
      res.status(500).json({ error: 'Failed to check credit balance' });
    }
  })();
}

/**
 * Post-response credit deduction (async, non-blocking).
 * Deducts credits after a successful AI response is sent.
 * Must be placed after requirePackage.
 */
export function deductCreditsAfterResponse(req: Request, res: Response, next: NextFunction): void {
  // Hook into the response finish event
  const originalEnd = res.end;
  const originalJson = res.json;

  let responseBody: any = null;

  // Capture response body to calculate cost
  (res as any).json = function (body: any) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  (res as any).end = function (...args: any[]) {
    const result = (originalEnd as Function).apply(this, args);

    // Only deduct for successful responses
    if (res.statusCode >= 200 && res.statusCode < 300 && req.contactId) {
      const requestType = detectRequestType(req);
      const cost = calculateCost(requestType, responseBody);

      if (cost > 0) {
        packageService.deductCredits(
          req.contactId, cost,
          (req as any).user?.id || null,
          requestType,
          { path: req.path, method: req.method },
          `${requestType} request`
        ).then(result => {
          res.setHeader('X-Credit-Deducted', cost.toString());
          res.setHeader('X-Credit-Balance-After', result.balanceAfter.toString());
        }).catch(err => {
          console.error('[PackageMiddleware] Failed to deduct credits:', err.message);
        });
      }
    }

    return result;
  };

  next();
}

/**
 * Combined middleware: requirePackage + requireCredits + deductCreditsAfterResponse.
 * Use this for most AI endpoints.
 */
export function packageCreditMiddleware(req: Request, res: Response, next: NextFunction): void {
  requirePackage(req, res, (err) => {
    if (err) return next(err);
    requireCredits(req, res, (err) => {
      if (err) return next(err);
      deductCreditsAfterResponse(req, res, next);
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function detectRequestType(req: Request): string {
  const path = req.path.toLowerCase();
  if (path.includes('/chat') || path.includes('/conversation')) return 'TEXT_CHAT';
  if (path.includes('/embed') || path.includes('/ingest')) return 'TEXT_SIMPLE';
  if (path.includes('/image')) return 'TEXT_CHAT'; // image gen uses chat-level pricing
  if (path.includes('/tts') || path.includes('/speech')) return 'TEXT_SIMPLE';
  if (path.includes('/stt') || path.includes('/transcri')) return 'TEXT_SIMPLE';
  if (path.includes('/code') || path.includes('/execute')) return 'CODE_AGENT_EXECUTE';
  if (path.includes('/mcp')) return 'MCP_TOOL';
  if (path.includes('/file')) return 'FILE_OPERATION';
  if (path.includes('/broker')) return 'AI_BROKER';
  return 'AI_BROKER'; // fallback: minimal 1-credit charge
}

function calculateCost(requestType: string, responseBody: any): number {
  const costs = REQUEST_PRICING as Record<string, any>;
  const config = costs[requestType];

  if (!config) return 1; // minimum 1 credit for any API call

  let cost = config.baseCost || 1;

  // Add token-based cost if response contains token counts
  if (config.perTokenCost && responseBody) {
    const tokens = responseBody?.usage?.total_tokens
      || responseBody?.tokenCount
      || responseBody?.tokens
      || 0;
    cost += Math.ceil(tokens * config.perTokenCost);
  }

  // Apply multiplier
  if (config.perMultiplier) {
    cost = Math.ceil(cost * config.perMultiplier);
  }

  return Math.max(1, cost); // Always at least 1 credit
}
