import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { env } from '../config/env.js';
import { unauthorized } from '../utils/httpErrors.js';

export type AuthUser = {
  userId: string;
};

export interface AuthRequest extends Request {
  userId?: string;
  auth?: AuthUser;
}

// ── Cookie name for the HTTP-only auth token ───────────────────────
const AUTH_COOKIE = 'sw_token';

/**
 * Compute cookie options based on the current request origin.
 * Production (HTTPS) → Secure + SameSite=None so cross-origin works.
 * Development (HTTP)  → no Secure flag, SameSite=Lax.
 */
function cookieOpts(req: Request, maxAgeMs?: number) {
  const isHttps = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: maxAgeMs ?? 30 * 24 * 60 * 60 * 1000, // 30 days default
  };
}

/** Set the JWT as an HTTP-only cookie on the response. */
export function setAuthCookie(req: Request, res: Response, token: string, maxAgeMs?: number) {
  res.cookie(AUTH_COOKIE, token, cookieOpts(req, maxAgeMs));
}

/** Clear the auth cookie. */
export function clearAuthCookie(req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE, cookieOpts(req));
}

export function signAccessToken(payload: AuthUser, expiresIn?: string) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: (expiresIn || env.JWT_EXPIRES_IN) as any });
}

export function requireAuth(req: Request, _res: import('express').Response, next: import('express').NextFunction) {
  // 1. Prefer Authorization header (Bearer token)
  let token: string | undefined;
  const auth = req.header('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    token = auth.slice('bearer '.length);
  }

  // 2. Fall back to HTTP-only cookie
  if (!token && (req as any).cookies?.[AUTH_COOKIE]) {
    token = (req as any).cookies[AUTH_COOKIE];
  }

  if (!token) {
    return next(unauthorized('No token provided'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== 'object' || decoded === null || !('userId' in decoded)) {
      return next(unauthorized('Invalid token'));
    }

    const userId = String((decoded as any).userId);
    (req as AuthRequest).auth = { userId } satisfies AuthUser;
    (req as AuthRequest).userId = userId;
    return next();
  } catch {
    return next(unauthorized('Invalid token'));
  }
}

export function getAuth(req: import('express').Request): AuthUser {
  const auth = (req as any).auth as AuthUser | undefined;
  if (!auth) throw unauthorized('Not authenticated');
  return auth;
}
