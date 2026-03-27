import { NextFunction, Request, Response } from 'express';
import { AuthRequest } from './auth.js';
import { requireActivePackageForUser, getActivePackageForUser } from '../services/packageResolver.js';
import { db } from '../db/mysql.js';

function sendPackageError(res: Response, message: string) {
  return res.status(403).json({
    success: false,
    error: 'PACKAGE_LINK_REQUIRED',
    message,
  });
}

export async function requireActivePackageAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthRequest).userId;
    if (!userId) return next();
    await requireActivePackageForUser(userId);
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Active package required.';
    sendPackageError(res, message);
  }
}

export async function requireOwnerPackageAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const assistantId = req.params.assistantId || req.params.id || req.body?.assistantId;
    const clientId = (req.headers['x-widget-client-id'] as string) || req.params.clientId || req.body?.clientId;

    let ownerUserId: string | null = null;

    if (assistantId) {
      const assistant = await db.queryOne<{ userId: string | null }>('SELECT userId FROM assistants WHERE id = ?', [assistantId]);
      ownerUserId = assistant?.userId ?? null;
    } else if (clientId) {
      const widget = await db.queryOne<{ user_id: string | null }>('SELECT user_id FROM widget_clients WHERE id = ?', [clientId]);
      ownerUserId = widget?.user_id ?? null;
    }

    if (!ownerUserId) return next();

    const pkg = await getActivePackageForUser(ownerUserId);
    if (!pkg) {
      sendPackageError(res, 'This resource owner is not linked to a contact/company with an active package.');
      return;
    }

    next();
  } catch (error) {
    console.error('[packageAccess] Owner package access check failed:', error);
    sendPackageError(res, 'Unable to verify package access.');
  }
}
