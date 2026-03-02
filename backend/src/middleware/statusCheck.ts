/**
 * Status Check Middleware — "The Bouncer"
 * 
 * Centralized Express middleware that intercepts incoming requests,
 * identifies the resource being accessed, and checks the database
 * status flags before allowing the request through.
 * 
 * Hierarchy:
 *   1. Global Account (users.account_status)  — checked first
 *   2. Assistant (assistants.status)           — checked second
 *   3. Widget Client (widget_clients.status)   — checked second
 * 
 * If the global account is suspended, ALL sub-resources are blocked
 * regardless of their individual status.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db/mysql.js';

type ResourceStatus = 'active' | 'suspended' | 'demo_expired';

interface StatusRow {
  status: ResourceStatus;
  account_status?: ResourceStatus;
}

// ─── Friendly error messages per status ──────────────────────────────────
const STATUS_MESSAGES: Record<string, { code: number; error: string; detail: string }> = {
  suspended: {
    code: 403,
    error: 'ACCOUNT_SUSPENDED',
    detail: 'This account has been suspended. Please contact Soft Aware support.',
  },
  demo_expired: {
    code: 403,
    error: 'DEMO_EXPIRED',
    detail: 'Demo period has ended. Please contact Soft Aware to upgrade your plan.',
  },
};

function blockResponse(res: Response, status: string) {
  const msg = STATUS_MESSAGES[status] || STATUS_MESSAGES.suspended;
  return res.status(msg.code).json({
    success: false,
    error: msg.error,
    message: msg.detail,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Check account-level status for authenticated users
//    Attach to any route that has req.userId (i.e. after requireAuth)
// ─────────────────────────────────────────────────────────────────────────
export async function checkAccountStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).userId;
    if (!userId) return next(); // No auth context — let other middleware handle

    const user = await db.queryOne<{ account_status: ResourceStatus }>(
      'SELECT account_status FROM users WHERE id = ?',
      [userId]
    );

    if (!user) return next(); // User not found — auth middleware will catch this

    if (user.account_status !== 'active') {
      blockResponse(res, user.account_status);
      return;
    }

    next();
  } catch (err) {
    console.error('[statusCheck] Account status check failed:', err);
    next(); // Fail open — don't block on DB errors
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Check assistant-level status
//    Reads :assistantId from req.params or req.body.assistantId
//    Also checks the owning user's account_status (global override)
// ─────────────────────────────────────────────────────────────────────────
export async function checkAssistantStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const assistantId =
      req.params.assistantId ||
      req.params.id ||
      (req.body && req.body.assistantId);

    if (!assistantId) return next();

    // Single query: join assistants → users to check both levels
    const row = await db.queryOne<{ assistant_status: ResourceStatus; account_status: ResourceStatus | null }>(
      `SELECT a.status AS assistant_status, u.account_status
       FROM assistants a
       LEFT JOIN users u ON u.id = a.userId
       WHERE a.id = ?`,
      [assistantId]
    );

    if (!row) return next(); // Assistant not found — route handler will 404

    // Global override: if account is suspended, block regardless
    if (row.account_status && row.account_status !== 'active') {
      blockResponse(res, row.account_status);
      return;
    }

    // Assistant-level check
    if (row.assistant_status !== 'active') {
      blockResponse(res, row.assistant_status);
      return;
    }

    next();
  } catch (err) {
    console.error('[statusCheck] Assistant status check failed:', err);
    next(); // Fail open
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Check widget client status
//    Reads client ID from headers (X-Widget-Client-Id), params, or body
//    Also checks the owning user's account_status (global override)
// ─────────────────────────────────────────────────────────────────────────
export async function checkWidgetStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const clientId =
      req.headers['x-widget-client-id'] as string ||
      req.params.clientId ||
      (req.body && req.body.clientId);

    if (!clientId) return next();

    const row = await db.queryOne<{ widget_status: ResourceStatus; account_status: ResourceStatus | null }>(
      `SELECT wc.status AS widget_status, u.account_status
       FROM widget_clients wc
       LEFT JOIN users u ON u.id = wc.user_id
       WHERE wc.id = ?`,
      [clientId]
    );

    if (!row) return next(); // Widget not found — route handler will 404

    // Global override
    if (row.account_status && row.account_status !== 'active') {
      blockResponse(res, row.account_status);
      return;
    }

    // Widget-level check
    if (row.widget_status !== 'active') {
      blockResponse(res, row.widget_status);
      return;
    }

    next();
  } catch (err) {
    console.error('[statusCheck] Widget status check failed:', err);
    next(); // Fail open
  }
}
