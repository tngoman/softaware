/**
 * auditLogger.ts — Express middleware that logs every admin action to SQLite.
 *
 * Must be mounted AFTER requireAuth + requireAdmin so that req.userId is set.
 * Captures: who, what, when, response status, and duration.
 *
 * Usage (in app.ts or per-router):
 *   import { auditLogger } from '../middleware/auditLogger.js';
 *   adminRouter.use(auditLogger);
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { auditLog } from '../db/auditLog.js';
import { db } from '../db/mysql.js';

// Cache user info to avoid repeated DB lookups per request
const userInfoCache = new Map<string, { email: string; name: string; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getUserInfo(userId: string): Promise<{ email: string; name: string }> {
  const cached = userInfoCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return { email: cached.email, name: cached.name };
  }

  try {
    const user = await db.queryOne<{ email: string; name: string }>(
      'SELECT email, name FROM users WHERE id = ?',
      [userId]
    );
    if (user) {
      const name = user.name || '';
      const info = { email: user.email || '', name };
      userInfoCache.set(userId, { ...info, expires: Date.now() + CACHE_TTL });
      return info;
    }
  } catch (err) {
    console.error('[auditLogger] Failed to fetch user info:', err);
  }
  return { email: '', name: '' };
}

// Routes that are read-only and very frequent — skip logging to reduce noise
const SKIP_PATTERNS = [
  /^GET \/api\/admin\/audit-log/,  // Don't log viewing the audit log itself
];

// Strip large body fields to keep log entries reasonable
function sanitizeBody(body: any): string {
  if (!body || typeof body !== 'object') return '{}';
  try {
    const clone = { ...body };
    // Remove fields that are too large
    for (const key of Object.keys(clone)) {
      if (typeof clone[key] === 'string' && clone[key].length > 2000) {
        clone[key] = clone[key].substring(0, 200) + '...[truncated]';
      }
    }
    return JSON.stringify(clone);
  } catch {
    return '{}';
  }
}

export function auditLogger(req: AuthRequest, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const method = req.method;
  const resource = req.originalUrl || req.url;

  // Skip patterns (like viewing the audit log)
  const signature = `${method} ${resource}`;
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(signature)) {
      return next();
    }
  }

  // Capture response status when it finishes
  const originalEnd = res.end;
  const originalJson = res.json;

  let responseStatus = 0;

  // Override res.json to capture status
  res.json = function(this: Response, body: any) {
    responseStatus = res.statusCode;
    return originalJson.call(this, body);
  } as any;

  // Override res.end to log after response is sent
  res.end = function(this: Response, ...args: any[]) {
    responseStatus = responseStatus || res.statusCode;
    const duration = Date.now() - startTime;
    const userId = req.userId || '';
    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    // Log asynchronously — don't block the response
    getUserInfo(userId).then(userInfo => {
      auditLog.log({
        user_id: userId,
        user_email: userInfo.email,
        user_name: userInfo.name,
        action: method,
        resource,
        request_body: method !== 'GET' ? sanitizeBody(req.body) : '{}',
        response_status: responseStatus,
        ip_address: ip,
        user_agent: userAgent,
        duration_ms: duration,
      });
    }).catch(err => {
      console.error('[auditLogger] Logging failed:', err);
    });

    return originalEnd.apply(this, args as any);
  } as any;

  next();
}
