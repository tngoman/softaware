/**
 * absoluteUrl — Convert relative upload/avatar paths to absolute URLs.
 *
 * Mobile apps receive API responses directly and cannot resolve relative
 * paths like `/uploads/staff-chat/1/photo.jpg` the way a web frontend can.
 * This utility rewrites such paths to fully-qualified URLs using the
 * request's own origin (protocol + host).
 *
 * Usage:
 *   import { resolveUrlFields } from '../utils/absoluteUrl.js';
 *
 *   // In a route:
 *   res.json(resolveUrlFields(req, data));
 *
 *   // Or use the Express middleware on a router:
 *   import { absoluteUrlMiddleware } from '../utils/absoluteUrl.js';
 *   router.use(absoluteUrlMiddleware);
 */
import type { Request, Response, NextFunction } from 'express';

/** Fields that hold relative paths which should become absolute URLs. */
const URL_FIELDS = new Set([
  'file_url',
  'thumbnail_url',
  'avatar_url',
  'sender_avatar',
  'dm_other_avatar',
  'icon_url',
  'caller_avatar',
  'other_user_avatar',
  'creator_avatar',
  'profile_image',
  'profileImage',
]);

/**
 * Derive the public origin from an Express request.
 * Respects `X-Forwarded-Proto` / `X-Forwarded-Host` set by reverse proxies.
 */
export function getOrigin(req: Request): string {
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost').split(',')[0].trim();
  return `${proto}://${host}`;
}

/**
 * If `value` is a relative path (starts with `/`), prepend the origin.
 * Already-absolute URLs (http/https) and falsy values pass through unchanged.
 */
function resolveOne(origin: string, value: unknown): unknown {
  if (typeof value !== 'string' || !value) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return `${origin}${value}`;
  return value;
}

/**
 * Recursively walk a JSON-serialisable value and resolve every field
 * whose key is in URL_FIELDS.
 */
export function resolveUrlFields(req: Request, data: unknown): unknown {
  const origin = getOrigin(req);
  return walk(origin, data);
}

function walk(origin: string, node: unknown): unknown {
  if (node === null || node === undefined) return node;
  if (Array.isArray(node)) return node.map(item => walk(origin, item));
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      out[key] = URL_FIELDS.has(key) ? resolveOne(origin, obj[key]) : walk(origin, obj[key]);
    }
    return out;
  }
  return node;
}

/**
 * Express middleware that monkey-patches `res.json()` so every response
 * from downstream handlers automatically has URL fields resolved.
 *
 *   staffChatRouter.use(absoluteUrlMiddleware);
 */
export function absoluteUrlMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  (res as any).json = (body: any) => {
    return originalJson(resolveUrlFields(req, body));
  };
  next();
}
